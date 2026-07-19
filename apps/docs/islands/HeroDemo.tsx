export const client = "load";

import {
  isLayerCancelledError,
  layerOptions,
  LayerClient,
  StackOutlet,
  StackProvider,
  useLayer,
  useLayerClient,
  useLayerGroup,
  useStack,
  useStackHandles,
} from "@stainless-code/react-layers";
import type {
  LayerCallContext,
  LayerComponentProps,
  LayerKey,
  LayerState,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useCallback, useEffect, useSyncExternalStore, useState } from "react";

const ENTER_MS = 250;
const EXIT_MS = 200;

const heroClient = new LayerClient({
  defaultStackOptions: {
    "hero-serial": { scope: { strategy: "serial" } },
  },
});

const KEYFRAMES = `
  @keyframes hero-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes hero-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes hero-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes hero-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } }
  @keyframes hero-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(-120%); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes hero-toast-out { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-120%); } }
  @keyframes hero-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes hero-drawer-out { from { transform: translateX(0); } to { transform: translateX(100%); } }
  @keyframes hero-spin { to { transform: rotate(360deg); } }
`;

/* ── Shared primitives ── */

function Backdrop({
  transition,
  onClick,
}: {
  transition: LayerTransition;
  onClick?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-[8] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? "hero-backdrop-out 200ms ease-in forwards"
            : "hero-backdrop-in 200ms ease-out forwards",
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function CenterPane({
  transition,
  width,
  role,
  children,
}: {
  transition: LayerTransition;
  width: string;
  role?: "dialog" | "alertdialog";
  children: React.ReactNode;
}) {
  return (
    <div
      role={role ?? "dialog"}
      aria-modal="true"
      className={`absolute left-1/2 top-1/2 z-[9] rounded-blume border border-border bg-background p-4 shadow-2xl ${width}`}
      style={{
        animation:
          transition === "exiting"
            ? "hero-dialog-out 200ms ease-in forwards"
            : "hero-dialog-in 250ms ease-out forwards",
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  kind = "ghost",
  className = "",
  ...props
}: {
  kind?: "primary" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "rounded-blume px-4 py-2 text-sm transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-accent font-medium text-accent-foreground hover:opacity-90",
    danger: "bg-red-500 font-medium text-white hover:bg-red-600",
    ghost: "border border-border text-foreground hover:bg-muted",
  } as const;
  return (
    <button
      type="button"
      className={`${base} ${styles[kind]} ${className}`}
      {...props}
    />
  );
}

/* ── Demo components ── */

function HeroConfirmDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <CenterPane
        transition={transition}
        width="w-[min(340px,90%)]"
        role="alertdialog"
      >
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-5 text-muted-foreground text-sm leading-relaxed">
          {payload.message}
        </p>
        <div className="flex justify-end gap-3">
          <Btn onClick={() => call.end(false)}>No</Btn>
          <Btn kind="danger" onClick={() => call.end(true)}>
            Yes, delete
          </Btn>
        </div>
      </CenterPane>
    </>
  );
}

function HeroToast({
  call,
  payload,
  transition,
}: LayerComponentProps<{ message: string }, void>) {
  const states = useStack({ stack: "hero-toast" });
  const myIndex = states.findIndex((s) => s.id === call.layerId);
  const slot = states.filter(
    (s, i) => i < myIndex && s.transition !== "exiting",
  ).length;
  return (
    <div
      className="absolute z-[9] rounded-blume border border-border bg-background px-4 py-3 shadow-xl"
      style={{
        top: `${16 + slot * 56}px`,
        left: "50%",
        transition: "top 200ms ease",
        animation:
          transition === "exiting"
            ? "hero-toast-out 200ms ease-in forwards"
            : "hero-toast-in 250ms ease-out forwards",
      }}
      role="status"
    >
      <div className="flex items-center gap-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-green-500"
          aria-hidden="true"
        />
        <span className="text-foreground text-sm">{payload.message}</span>
        <button
          type="button"
          onClick={() => call.dismiss()}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function HeroProgressDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<
  { fileName: string; percent: number; speedKb: number },
  void
>) {
  const done = payload.percent >= 100;
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => call.dismiss(), 900);
      return () => clearTimeout(t);
    }
    return;
  }, [done, call]);

  const eta = done
    ? "Complete"
    : payload.speedKb > 0
      ? `${Math.ceil(((100 - payload.percent) / 100) * 4 * 10) / 10}s`
      : "—";

  return (
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition} width="w-[min(360px,90%)]">
        <div className="mb-1 flex items-center gap-2.5">
          {done ? (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "var(--blume-success)" }}
              aria-label="done"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                viewBox="0 0 24 24"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
          ) : (
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent"
              style={{ animation: "hero-spin 700ms linear infinite" }}
              aria-label="working"
            />
          )}
          <h2
            className="text-lg font-semibold transition-colors"
            style={done ? { color: "var(--blume-success)" } : undefined}
          >
            {done ? "Done!" : "Uploading…"}
          </h2>
        </div>

        <p className="mb-4 truncate font-mono text-muted-foreground text-xs">
          {payload.fileName}
        </p>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-200 ease-linear"
            style={{
              width: `${payload.percent}%`,
              backgroundColor: done
                ? "var(--blume-success)"
                : "var(--blume-accent)",
            }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between font-mono text-muted-foreground text-xs">
          <span>{done ? "—" : `${payload.speedKb.toFixed(1)} MB/s`}</span>
          <span>{eta}</span>
          <span className="font-medium text-foreground">
            {payload.percent}%
          </span>
        </div>
      </CenterPane>
    </>
  );
}

function HeroDrawer({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute top-0 right-0 z-[9] flex h-full w-[min(300px,85%)] flex-col rounded-blume border border-border bg-background p-4 shadow-2xl"
        style={{
          animation:
            transition === "exiting"
              ? "hero-drawer-out 200ms ease-in forwards"
              : "hero-drawer-in 250ms ease-out forwards",
        }}
      >
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
          Drawers, sheets, and slide-overs are just layers on a named stack —
          same
          <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">
            await client.open
          </code>
          as a dialog.
        </p>
        <div className="mt-auto flex justify-end gap-3">
          <Btn onClick={() => call.end(false)}>Cancel</Btn>
          <Btn kind="primary" onClick={() => call.end(true)}>
            Done
          </Btn>
        </div>
      </div>
    </>
  );
}

function HeroNestedConfirm({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <>
      <div
        className="absolute inset-0 z-[8] bg-black/25"
        style={{
          animation:
            transition === "exiting"
              ? "hero-backdrop-out 200ms ease-in forwards"
              : "hero-backdrop-in 200ms ease-out forwards",
        }}
        onClick={() => call.end(false)}
        aria-hidden="true"
      />
      <CenterPane
        transition={transition}
        width="w-[min(300px,90%)]"
        role="alertdialog"
      >
        <h2 className="mb-2 text-base font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-5 text-muted-foreground text-sm">{payload.message}</p>
        <div className="flex justify-end gap-2.5">
          <Btn onClick={() => call.end(false)}>Cancel</Btn>
          <Btn kind="primary" onClick={() => call.end(true)}>
            Apply
          </Btn>
        </div>
      </CenterPane>
    </>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-blume border border-border bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function HeroNestedDrawer({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call, { name: "confirm" });
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoSave: true,
  });
  const toggle = (k: keyof typeof settings) =>
    setSettings((s) => ({ ...s, [k]: !s[k] }));

  const save = async () => {
    try {
      const ok = await group.open({
        key: ["hero-nested-confirm"],
        component: HeroNestedConfirm,
        enteringDelay: ENTER_MS,
        exitingDelay: EXIT_MS,
        payload: {
          title: "Apply changes?",
          message: "Update your account settings.",
        },
      });
      if (ok) setSaved(true);
    } catch (error) {
      if (!isLayerCancelledError(error)) throw error;
    }
  };

  return (
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute top-0 right-0 z-[9] flex h-full w-[min(340px,88%)] flex-col rounded-blume border border-border bg-background p-4 shadow-2xl"
        style={{
          animation:
            transition === "exiting"
              ? "hero-drawer-out 200ms ease-in forwards"
              : "hero-drawer-in 250ms ease-out forwards",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {payload.title}
          </h2>
          {saved && (
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: "var(--blume-success)" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--blume-success)" }}
                aria-hidden="true"
              />
              Saved
            </span>
          )}
        </div>
        <p className="mb-5 mt-1 text-muted-foreground text-xs">
          This drawer owns a child stack — opening a confirm nests
          automatically.
        </p>

        <div className="space-y-2.5">
          <Toggle
            label="Notifications"
            hint="Email + push alerts"
            checked={settings.notifications}
            onChange={() => toggle("notifications")}
          />
          <Toggle
            label="Dark mode"
            hint="Sync with system"
            checked={settings.darkMode}
            onChange={() => toggle("darkMode")}
          />
          <Toggle
            label="Auto-save"
            hint="Every 30 seconds"
            checked={settings.autoSave}
            onChange={() => toggle("autoSave")}
          />
        </div>

        <div className="mt-auto flex justify-end gap-3 pt-5">
          <Btn onClick={() => call.end(false)}>Close</Btn>
          <Btn kind="primary" onClick={() => void save()}>
            Save changes
          </Btn>
        </div>
        <group.Outlet />
      </div>
    </>
  );
}

interface HeroProfile {
  name: string;
  role: string;
  initials: string;
  status: "online" | "away" | "offline";
  joined: string;
  projects: number;
  uptime: string;
}

function HeroAsyncDialog({
  call,
  payload,
  data,
  phase,
  transition,
}: LayerComponentProps<{ userId: string }, void, HeroProfile>) {
  const statusDot = {
    online: "bg-green-500",
    away: "bg-amber-500",
    offline: "bg-muted-foreground",
  } as const;
  return (
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition} width="w-[min(360px,90%)]">
        <p className="mb-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          User profile · {payload.userId}
        </p>
        {phase === "pending" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground text-sm">
            <span
              className="inline-block h-7 w-7 rounded-full border-2 border-accent border-t-transparent"
              style={{ animation: "hero-spin 700ms linear infinite" }}
            />
            Fetching profile…
          </div>
        ) : (
          <div className="text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">
                {data?.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-foreground">
                    {data?.name}
                  </span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusDot[data?.status ?? "offline"]}`}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {data?.role}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Projects", value: data?.projects },
                { label: "Uptime", value: data?.uptime },
                { label: "Joined", value: data?.joined },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-blume border border-border bg-muted/20 p-2 text-center"
                >
                  <div className="font-semibold text-foreground">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <Btn
              kind="primary"
              className="mt-4 w-full"
              onClick={() => call.dismiss()}
            >
              Close
            </Btn>
          </div>
        )}
      </CenterPane>
    </>
  );
}

function HeroDiscardConfirm({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <>
      <div
        className="absolute inset-0 z-[8] bg-black/25"
        style={{
          animation:
            transition === "exiting"
              ? "hero-backdrop-out 200ms ease-in forwards"
              : "hero-backdrop-in 200ms ease-out forwards",
        }}
        onClick={() => call.end(false)}
        aria-hidden="true"
      />
      <CenterPane
        transition={transition}
        width="w-[min(300px,90%)]"
        role="alertdialog"
      >
        <h2 className="mb-2 text-base font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-5 text-muted-foreground text-sm">{payload.message}</p>
        <div className="flex justify-end gap-2.5">
          <Btn onClick={() => call.end(false)}>Cancel</Btn>
          <Btn kind="primary" onClick={() => call.end(true)}>
            Discard
          </Btn>
        </div>
      </CenterPane>
    </>
  );
}

function HeroBlockerDialog({
  call,
  payload,
  transition,
  dismissing,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call, { name: "discard" });
  const [text, setText] = useState("");
  const dirty = text.length > 0;
  useEffect(() => call.addBlocker(() => !dirty), [call, dirty]);

  const attemptClose = async () => {
    if (!dirty) {
      call.end(false);
      return;
    }
    try {
      const discard = await group.open({
        key: ["hero-discard"],
        component: HeroDiscardConfirm,
        enteringDelay: ENTER_MS,
        exitingDelay: EXIT_MS,
        payload: {
          title: "Discard changes?",
          message: "You'll lose your unsaved edits.",
        },
      });
      if (discard) call.end(false, { force: true });
    } catch (error) {
      if (!isLayerCancelledError(error)) throw error;
    }
  };

  return (
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <CenterPane transition={transition} width="w-[min(360px,90%)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {payload.title}
          </h2>
          {dirty && (
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs dark:text-amber-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              unsaved
            </span>
          )}
        </div>
        <p className="mb-4 text-muted-foreground text-xs leading-relaxed">
          A blocker vetoes dismissal while there are unsaved edits. Backdrop
          clicks bounce off; closing opens a discard confirm; force bypasses the
          blocker.
        </p>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Display name
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type to make the form dirty…"
          className="mb-2 w-full rounded-blume border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
        />

        {dismissing && (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            blocker consulted → vetoed
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <Btn
            kind="ghost"
            onClick={() => call.end(true, { force: true })}
            className="text-amber-600 dark:text-amber-400"
          >
            Force close
          </Btn>
          <Btn kind="primary" onClick={() => void attemptClose()}>
            Close
          </Btn>
        </div>
        <group.Outlet />
      </CenterPane>
    </>
  );
}

function HeroAnnouncement({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string; body: string }, void>) {
  useEffect(() => {
    const t = setTimeout(() => call.dismiss(), 2200);
    return () => clearTimeout(t);
  }, [call]);
  return (
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition} width="w-[min(320px,90%)]">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="text-muted-foreground text-sm">{payload.body}</p>
        <div className="mt-5 flex justify-end">
          <Btn kind="primary" onClick={() => call.dismiss()}>
            Acknowledge
          </Btn>
        </div>
      </CenterPane>
    </>
  );
}

/* ── Layer options ── */

const enterExit = { enteringDelay: ENTER_MS, exitingDelay: EXIT_MS } as const;

const confirmOpts = layerOptions<{ title: string; message: string }, boolean>({
  stack: "hero-confirm",
  key: ["hero-confirm"],
  component: HeroConfirmDialog,
  ...enterExit,
});
const toastOpts = layerOptions<{ message: string }, void>({
  stack: "hero-toast",
  key: ["hero-toast"],
  upsert: false,
  component: HeroToast,
  ...enterExit,
});
const progressOpts = layerOptions<
  { fileName: string; percent: number; speedKb: number },
  void
>({
  stack: "hero-progress",
  key: ["hero-progress"],
  upsert: true,
  component: HeroProgressDialog,
  ...enterExit,
});
const drawerOpts = layerOptions<{ title: string }, boolean>({
  stack: "hero-drawer",
  key: ["hero-drawer"],
  component: HeroDrawer,
  ...enterExit,
});
const nestedOpts = layerOptions<{ title: string }, boolean>({
  stack: "hero-nested",
  key: ["hero-nested"],
  component: HeroNestedDrawer,
  ...enterExit,
});
const asyncOpts = layerOptions<{ userId: string }, void, never, HeroProfile>({
  stack: "hero-async",
  key: ["hero-async"],
  component: HeroAsyncDialog,
  loadFn: async () => {
    await new Promise((r) => setTimeout(r, 900));
    return {
      name: "Ada Lovelace",
      role: "Founding Engineer",
      initials: "AL",
      status: "online",
      joined: "Mar 2021",
      projects: 12,
      uptime: "99.98%",
    };
  },
  ...enterExit,
});
const blockerOpts = layerOptions<{ title: string }, boolean>({
  stack: "hero-blocker",
  key: ["hero-blocker"],
  component: HeroBlockerDialog,
  ...enterExit,
});
const announceOpts = layerOptions<{ title: string; body: string }, void>({
  stack: "hero-serial",
  key: ["hero-announce"],
  component: HeroAnnouncement,
  ...enterExit,
});

/* ── Dev panel hooks ── */

function useQueued(stackId: string): LayerState[] {
  const client = useLayerClient();
  const stack = client.getStack(stackId);
  const subscribe = useCallback(
    (cb: () => void) => stack.subscribe(cb),
    [stack],
  );
  const getSnap = useCallback(() => stack.getQueuedSnapshot(), [stack]);
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}

function useStackIds(): string[] {
  const client = useLayerClient();
  const [ids, setIds] = useState<string[]>(() => client.getStackIds());
  useEffect(() => {
    const update = () => setIds(client.getStackIds());
    update();
    return client.subscribeStacks(update);
  }, [client]);
  return ids;
}

/* ── Dev panel ── */

const PHASE_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  queued: "bg-muted text-muted-foreground",
  active: "bg-accent/15 text-accent",
  dismissed: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
};
const TRANSITION_STYLES: Record<string, string> = {
  entering: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  settled: "bg-muted text-muted-foreground",
  exiting: "bg-muted text-muted-foreground",
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

function Json({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/60 p-1.5 font-mono text-[10px] leading-tight text-muted-foreground">
      {JSON.stringify(value)}
    </pre>
  );
}

function LayerRow({
  state,
  queued,
  getCall,
  onCancel,
}: {
  state: LayerState;
  queued?: boolean;
  getCall?: (s: LayerState) => LayerCallContext;
  onCancel?: (key: LayerKey) => void;
}) {
  const key = Array.isArray(state.key)
    ? state.key.join("-")
    : String(state.key);
  return (
    <div
      className={`rounded-blume border px-2.5 py-2 text-xs ${
        queued
          ? "border-dashed border-border bg-muted/20"
          : "border-border bg-background"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            queued ? "bg-muted-foreground" : "bg-accent"
          }`}
          aria-hidden="true"
        />
        <span className="flex-1 truncate font-mono text-foreground">{key}</span>
        <Badge label={state.phase} cls={PHASE_STYLES[state.phase] ?? ""} />
        {!queued && (
          <Badge
            label={state.transition}
            cls={TRANSITION_STYLES[state.transition] ?? ""}
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
        <span>id:{state.id.slice(0, 8)}</span>
        <span>
          idx:{state.index}/{state.stackSize}
        </span>
        {!queued && state.actionStatus === "running" && <span>running</span>}
        {!queued && state.dismissing && (
          <span className="text-amber-600">dismissing</span>
        )}
        {state.ended && <span>ended</span>}
      </div>

      {state.payload !== undefined && <Json value={state.payload} />}
      {!queued && state.data !== undefined && <Json value={state.data} />}
      {state.response !== undefined && <Json value={state.response} />}
      {state.error !== undefined && <Json value={state.error} />}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {queued && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(state.key)}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            cancelQueued
          </button>
        )}
        {!queued && getCall && state.transition === "entering" && (
          <button
            type="button"
            onClick={() => getCall(state).settle()}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            settle
          </button>
        )}
        {!queued && getCall && state.phase !== "dismissed" && (
          <button
            type="button"
            onClick={() => getCall(state).dismiss(undefined as never)}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            dismiss
          </button>
        )}
        {!queued && getCall && state.phase !== "dismissed" && (
          <button
            type="button"
            onClick={() =>
              getCall(state).dismiss(undefined as never, { force: true })
            }
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            force
          </button>
        )}
      </div>
    </div>
  );
}

function DevPanel({
  activeStack,
  onSelectStack,
}: {
  activeStack: string;
  onSelectStack: (id: string) => void;
}) {
  const client = useLayerClient();
  const stackIds = useStackIds();
  const { states, getCall } = useStackHandles(activeStack);
  const queued = useQueued(activeStack);
  const stack = client.getStack(activeStack);
  const scope = stack.options.scope?.strategy ?? "parallel";
  const mode = stack.options.dismissAllMode ?? "skipBlocked";
  const gc = stack.options.gcTime ?? 0;

  return (
    <div className="flex h-full flex-col gap-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">Layer inspector</span>
        <span className="font-mono text-muted-foreground">devtools</span>
      </div>

      {/* Stacks overview */}
      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Stacks ({stackIds.length})
        </div>
        <div className="flex flex-wrap gap-1">
          {stackIds.length === 0 && (
            <span className="text-muted-foreground">none materialized</span>
          )}
          {stackIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectStack(id)}
              className={`max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                id === activeStack
                  ? "border-accent text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              title={id}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Active stack meta */}
      <div className="rounded-blume border border-border bg-muted/20 p-2">
        <div className="mb-1 truncate font-mono text-foreground">
          {activeStack}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            label={`scope:${scope}`}
            cls="bg-muted text-muted-foreground"
          />
          <Badge
            label={`dismissAll:${mode}`}
            cls="bg-muted text-muted-foreground"
          />
          <Badge
            label={`gcTime:${gc}ms`}
            cls="bg-muted text-muted-foreground"
          />
        </div>
      </div>

      {/* Mounted + queued layers */}
      <div className="flex-1 overflow-y-auto">
        <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Mounted ({states.length})</span>
          <span>Queued ({queued.length})</span>
        </div>
        {states.length === 0 && queued.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-blume border border-dashed border-border text-muted-foreground text-[11px]">
            empty — run a demo
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {states.map((s) => (
            <LayerRow key={s.id} state={s} getCall={getCall} />
          ))}
          {queued.map((s) => (
            <LayerRow
              key={s.id}
              state={s}
              queued
              onCancel={(key) => stack.cancelQueued(key, undefined as never)}
            />
          ))}
        </div>
      </div>

      {/* Stack controls */}
      <div className="border-border border-t pt-2">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          dismissAll modes
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["skipBlocked", "stopAtBlocked", "force"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() =>
                void client.dismissAll(activeStack, undefined, { mode: m })
              }
              className="rounded border border-border px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main showcase ── */

type DemoTab =
  | "confirm"
  | "toast"
  | "progress"
  | "drawer"
  | "serial"
  | "nested"
  | "async"
  | "blocker";

const TABS: { id: DemoTab; label: string; stack: string; hint: string }[] = [
  {
    id: "confirm",
    label: "Confirm",
    stack: "hero-confirm",
    hint: "await boolean result",
  },
  {
    id: "toast",
    label: "Toast",
    stack: "hero-toast",
    hint: "parallel + auto-dismiss",
  },
  {
    id: "progress",
    label: "Progress",
    stack: "hero-progress",
    hint: "upsert + live payload update",
  },
  {
    id: "drawer",
    label: "Drawer",
    stack: "hero-drawer",
    hint: "slide-over overlay",
  },
  {
    id: "serial",
    label: "Serial",
    stack: "hero-serial",
    hint: "scope:serial queue",
  },
  {
    id: "nested",
    label: "Nested",
    stack: "hero-nested",
    hint: "useLayerGroup child stack",
  },
  {
    id: "async",
    label: "Async",
    stack: "hero-async",
    hint: "loadFn + pending/data phases",
  },
  {
    id: "blocker",
    label: "Blocker",
    stack: "hero-blocker",
    hint: "addBlocker + discard confirm + force",
  },
];

const ANNOUNCEMENTS = [
  {
    title: "Build #142 shipped",
    body: "All checks green and deployed to staging.",
  },
  { title: "Incident resolved", body: "API latency is back to baseline." },
  { title: "Scheduled maintenance", body: "Sunday 02:00–02:30 UTC." },
];

let toastCounter = 0;

function HeroShowcase() {
  const client = useLayerClient();
  const confirm = useLayer(confirmOpts);
  const progress = useLayer(progressOpts);
  const drawer = useLayer(drawerOpts);
  const nested = useLayer(nestedOpts);
  const asyncLayer = useLayer(asyncOpts);
  const blocker = useLayer(blockerOpts);
  const [activeTab, setActiveTab] = useState<DemoTab>("confirm");
  const [inspectedStack, setInspectedStack] = useState<string>("hero-confirm");
  const [trace, setTrace] = useState<string[]>([]);

  const addTrace = (msg: string) =>
    setTrace((prev) => [...prev.slice(-4), msg]);

  const switchTab = (tab: DemoTab) => {
    for (const id of client.getStackIds()) {
      void client.dismissAll(id, undefined, { mode: "force" });
    }
    setActiveTab(tab);
    const next = TABS.find((t) => t.id === tab)!.stack;
    setInspectedStack(next);
    setTrace([]);
    toastCounter = 0;
  };

  const runConfirm = async () => {
    setTrace([]);
    const ok = await confirm.open({
      title: "Delete this file?",
      message: "This action cannot be undone. Continue?",
    });
    addTrace(`await open → ${ok ? "✓ true" : "✕ false"}`);
  };

  const runToast = () => {
    toastCounter++;
    const id = toastCounter;
    void client.open({
      ...toastOpts,
      key: ["hero-toast", id],
      payload: { message: `Toast #${id}` },
    });
    addTrace(`open toast #${id}`);
  };

  const runProgress = () => {
    setTrace([]);
    void progress.open({
      fileName: "layers-core-1.4.0.tgz",
      percent: 0,
      speedKb: 0,
    });
    const layer = progress.stack.find(["hero-progress"]);
    if (!layer) return;
    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + Math.round(6 + Math.random() * 8));
      const speed = Math.round((8 + Math.random() * 6) * 10) / 10;
      progress.stack.update(layer, { percent: pct, speedKb: speed } as never);
      progress.stack.setRunning(layer, pct < 100);
      if (pct >= 100) clearInterval(tick);
    }, 130);
    addTrace("open progress → live payload updates");
  };

  const runDrawer = async () => {
    setTrace([]);
    const ok = await drawer.open({ title: "Filter options" });
    addTrace(`await open → ${ok ? "✓ done" : "✕ cancelled"}`);
  };

  const runSerial = () => {
    setTrace([]);
    ANNOUNCEMENTS.forEach((a, i) => {
      void client.open({
        ...announceOpts,
        key: ["hero-announce", i],
        payload: a,
      });
    });
    addTrace("queued 3 → serial plays one at a time");
  };

  const runNested = async () => {
    setTrace([]);
    const ok = await nested.open({ title: "Account settings" });
    addTrace(`nested drawer → ${ok ? "✓ saved" : "✕ closed"}`);
  };

  const runAsync = () => {
    setTrace([]);
    void asyncLayer.open({ userId: "ada" });
    addTrace("open → loadFn pending → data");
  };

  const runBlocker = async () => {
    setTrace([]);
    const ok = await blocker.open({ title: "Edit profile" });
    addTrace(`form → ${ok ? "✓ force-closed" : "✕ discarded"}`);
  };

  const handleRun = () => {
    if (activeTab === "confirm") void runConfirm();
    else if (activeTab === "toast") runToast();
    else if (activeTab === "progress") runProgress();
    else if (activeTab === "drawer") void runDrawer();
    else if (activeTab === "serial") runSerial();
    else if (activeTab === "nested") void runNested();
    else if (activeTab === "async") runAsync();
    else void runBlocker();
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;
  const runLabel: Record<DemoTab, string> = {
    confirm: "Open confirm",
    toast: "Fire toast",
    progress: "Start progress",
    drawer: "Open drawer",
    serial: "Queue 3 announcements",
    nested: "Open drawer",
    async: "Open async",
    blocker: "Open form",
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRun}
          className="rounded-blume bg-accent px-3.5 py-1.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        >
          {runLabel[activeTab]}
        </button>
        <span className="font-mono text-muted-foreground text-[11px]">
          {activeTabMeta.hint}
        </span>
      </div>

      {trace.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {trace.map((msg, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 rounded-blume bg-muted px-2 py-1 font-mono text-foreground text-[11px]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  msg.includes("✕") ? "bg-red-500" : "bg-green-500"
                }`}
                aria-hidden="true"
              />
              {msg}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="relative h-[560px] overflow-hidden rounded-blume border border-border bg-muted/20">
          <StackOutlet stack="hero-confirm" />
          <StackOutlet stack="hero-toast" />
          <StackOutlet stack="hero-progress" />
          <StackOutlet stack="hero-drawer" />
          <StackOutlet stack="hero-serial" />
          <StackOutlet stack="hero-nested" />
          <StackOutlet stack="hero-async" />
          <StackOutlet stack="hero-blocker" />
        </div>

        <div className="h-[560px] overflow-hidden rounded-blume border border-border bg-background p-3">
          <DevPanel
            activeStack={inspectedStack}
            onSelectStack={setInspectedStack}
          />
        </div>
      </div>
    </div>
  );
}

export default function HeroDemo() {
  return (
    <StackProvider client={heroClient}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <HeroShowcase />
    </StackProvider>
  );
}
