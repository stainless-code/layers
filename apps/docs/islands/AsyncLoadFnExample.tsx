export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const ENTER_MS = 200;
const EXIT_MS = 200;

const KEYFRAMES = `
  @keyframes async-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes async-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes async-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes async-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }
  @keyframes async-spin { to { transform: rotate(360deg); } }
`;

interface Profile {
  name: string;
  role: string;
  initials: string;
  status: "online" | "away" | "offline";
  joined: string;
  projects: number;
  uptime: string;
}

function Backdrop({ transition }: { transition: LayerTransition }) {
  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? `async-backdrop-out ${EXIT_MS}ms ease-in forwards`
            : `async-backdrop-in ${ENTER_MS}ms ease-out forwards`,
      }}
      aria-hidden="true"
    />
  );
}

function CenterPane({
  transition,
  children,
}: {
  transition: LayerTransition;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed left-1/2 top-1/2 z-[9999] w-[min(360px,90vw)] rounded-blume border border-border bg-background p-6 shadow-2xl"
      style={{
        animation:
          transition === "exiting"
            ? `async-dialog-out ${EXIT_MS}ms ease-in forwards`
            : `async-dialog-in 250ms ease-out forwards`,
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
  kind?: "primary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "rounded-blume px-4 py-2 text-sm transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-accent font-medium text-accent-foreground hover:opacity-90",
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

function ProfileDialog({
  call,
  payload,
  data,
  phase,
  transition,
}: LayerComponentProps<{ userId: string }, void, never, Profile>) {
  const statusDot = {
    online: "bg-green-500",
    away: "bg-amber-500",
    offline: "bg-muted-foreground",
  } as const;
  return overlayPortal(
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition}>
        <p className="mb-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          User profile · {payload.userId}
        </p>
        {phase === "pending" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground text-sm">
            <span
              className="inline-block h-7 w-7 rounded-full border-2 border-accent border-t-transparent"
              style={{ animation: "async-spin 700ms linear infinite" }}
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
    </>,
  );
}

const profile = layerOptions<{ userId: string }, void, never, Profile>({
  stack: "example-async-loadfn",
  key: ["example-async-loadfn"],
  component: ProfileDialog,
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
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function Trigger() {
  const profileLayer = useLayer(profile);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        onClick={() => {
          setPhase("loading");
          void profileLayer
            .open({ userId: "ada" })
            .then(() => setPhase("done"));
        }}
      >
        Open async dialog
      </button>
      {phase !== "idle" && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          {phase === "loading" ? "Loading…" : "Closed"}
        </span>
      )}
    </div>
  );
}

export default function AsyncLoadFnExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-async-loadfn" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
