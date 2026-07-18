import {
  useLayer,
  useLayerClient,
  useQueuedStack,
} from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

import { WIZARD_STACK } from "./client";
import {
  animatedLayer,
  blockedEditLayer,
  confirmLayer,
  deployLayer,
  drawerLayer,
  formatValidationError,
  inviteLayer,
  nestedParentLayer,
  profileLayer,
  progressLayer,
  toastLayer,
  wizardPayloads,
  wizardSteps,
} from "./layers";
import { Btn } from "./ui";

interface FeedItem {
  id: number;
  label: string;
  detail: string;
  tone: "neutral" | "ok" | "warn";
}

let feedSeq = 0;

function pushFeed(
  setFeed: React.Dispatch<React.SetStateAction<FeedItem[]>>,
  label: string,
  detail: string,
  tone: FeedItem["tone"] = "neutral",
) {
  setFeed((prev) => [
    { id: ++feedSeq, label, detail, tone },
    ...prev.slice(0, 7),
  ]);
}

function QueueBadge() {
  const client = useLayerClient();
  const stack = client.getStack(WIZARD_STACK);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const sync = () => setQueued(stack.getQueuedSnapshot().length);
    sync();
    return stack.subscribe(sync);
  }, [stack]);

  if (queued === 0) return null;

  return (
    <span className="rounded-full bg-[var(--teal-glow)] px-2.5 py-1 text-xs font-medium text-[var(--teal)]">
      {queued} queued
    </span>
  );
}

function Capability({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[var(--radius)] border border-[var(--ink-border)] bg-[var(--ink-raised)]/70 p-4">
      <h3
        className="mb-1 text-sm font-semibold text-[var(--ink-text)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <p className="mb-3 text-xs leading-relaxed text-[var(--ink-muted)]">
        {description}
      </p>
      {children}
    </article>
  );
}

export function DemoPage() {
  const confirm = useLayer(confirmLayer);
  const nested = useLayer(nestedParentLayer);
  const blocked = useLayer(blockedEditLayer);
  const profile = useLayer(profileLayer);
  const animated = useLayer(animatedLayer);
  const drawer = useLayer(drawerLayer);
  const toast = useLayer(toastLayer);
  const progress = useLayer(progressLayer);
  const deploy = useLayer(deployLayer);
  const invite = useLayer(inviteLayer);
  const w1 = useLayer(wizardSteps[0]);
  const w2 = useLayer(wizardSteps[1]);
  const w3 = useLayer(wizardSteps[2]);

  const toastCount = useQueuedStack({
    stack: "toast",
    select: (s) => s.length,
  });

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div style={{ animation: "fade-up 600ms ease both" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            DevTools playground
          </p>
          <h1
            className="mb-4 text-balance text-4xl font-medium tracking-tight text-[var(--ink-text)] sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Layers orchestrates every overlay in your app.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--ink-muted)]">
            Headless stack manager — await confirms, queue wizards, nest
            dialogs, block dismissals, load async data, animate enter/exit, and
            inspect live state in TanStack DevTools. One cohesive surface, zero
            UI library lock-in.
          </p>
        </div>

        <div
          className="rounded-[var(--radius)] border border-[var(--ink-border)] bg-[var(--ink-panel)] p-5"
          style={{ animation: "fade-up 700ms ease both" }}
        >
          <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            Live signals
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-1.5">
              stacks:{" "}
              <strong className="text-[var(--teal)]">
                modal · toast · wizard
              </strong>
            </span>
            <span className="rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-1.5">
              toasts mounted: <strong>{toastCount}</strong>
            </span>
            <QueueBadge />
          </div>
          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            Open TanStack DevTools (bottom) → <strong>Layers</strong> panel.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          className="grid gap-3 sm:grid-cols-2"
          style={{ animation: "fade-up 800ms ease both" }}
        >
          <Capability
            title="Awaited confirm"
            description="open() returns a Promise — branch on the boolean."
          >
            <Btn
              variant="primary"
              className="w-full"
              onClick={async () => {
                const ok = await confirm.open({
                  title: "Delete production deployment?",
                  detail:
                    "Traffic will fail over immediately. This cannot be undone.",
                });
                pushFeed(
                  setFeed,
                  "Confirm",
                  ok ? "User confirmed delete" : "User cancelled",
                  ok ? "warn" : "neutral",
                );
              }}
            >
              Delete deployment
            </Btn>
          </Capability>

          <Capability
            title="Serial queue"
            description="Wizard stack uses scope.strategy serial — three steps queue."
          >
            <Btn
              className="w-full"
              onClick={() => {
                void w1.open(wizardPayloads[0]);
                void w2.open(wizardPayloads[1]);
                void w3.open(wizardPayloads[2]);
                pushFeed(setFeed, "Wizard", "Queued 3 onboarding steps");
              }}
            >
              Launch onboarding
            </Btn>
          </Capability>

          <Capability
            title="Nested overlays"
            description="useLayerGroup opens child confirms scoped to the parent."
          >
            <Btn
              className="w-full"
              onClick={() => {
                void nested.open({ title: "Edit deployment" });
                pushFeed(setFeed, "Nested", "Parent opened");
              }}
            >
              Edit with nested confirm
            </Btn>
          </Capability>

          <Capability
            title="Dismissal blockers"
            description="addBlocker vetoes dismiss until discard confirm or force."
          >
            <Btn
              className="w-full"
              onClick={async () => {
                const saved = await blocked.open({ title: "Edit runbook" });
                pushFeed(
                  setFeed,
                  "Blockers",
                  saved ? "Force-closed" : "Closed cleanly",
                );
              }}
            >
              Dirty form dialog
            </Btn>
          </Capability>

          <Capability
            title="Async loadFn"
            description="Data loads with abort signal before content settles."
          >
            <Btn
              className="w-full"
              onClick={() => {
                void profile.open({ userId: "ada" });
                pushFeed(setFeed, "Async", "Profile layer opened");
              }}
            >
              Load profile
            </Btn>
          </Capability>

          <Capability
            title="Enter / exit transitions"
            description="enteringDelay + call.settle() for CSS transitions."
          >
            <Btn
              className="w-full"
              onClick={() => {
                void animated.open({ title: "Animated handoff" });
                pushFeed(setFeed, "Transitions", "Animated dialog opened");
              }}
            >
              Animated dialog
            </Btn>
          </Capability>

          <Capability
            title="Drawer / sheet"
            description="Side panel on the modal stack with backdrop."
          >
            <Btn
              className="w-full"
              onClick={async () => {
                const saved = await drawer.open({ title: "Stack settings" });
                pushFeed(
                  setFeed,
                  "Drawer",
                  saved ? "Settings saved" : "Drawer dismissed",
                );
              }}
            >
              Open drawer
            </Btn>
          </Capability>

          <Capability
            title="Toast stack"
            description="Non-modal parallel stack — top-right transient layers."
          >
            <div className="flex gap-2">
              <Btn
                className="flex-1"
                onClick={() => {
                  void toast.open({ message: "Changes saved", tone: "ok" });
                  pushFeed(setFeed, "Toast", "Success toast fired", "ok");
                }}
              >
                Success toast
              </Btn>
              <Btn
                variant="subtle"
                className="flex-1"
                onClick={() => {
                  void toast.open({
                    message: "Rate limit approaching",
                    tone: "warn",
                  });
                  pushFeed(setFeed, "Toast", "Warning toast fired", "warn");
                }}
              >
                Warn toast
              </Btn>
            </div>
          </Capability>

          <Capability
            title="Progress overlay"
            description="stack.update drives live payload while layer is open."
          >
            <Btn
              className="w-full"
              onClick={() => {
                void progress.open({ percent: 0, label: "Uploading bundle…" });
                const layer = progress.stack.find(["playground", "progress"]);
                if (!layer) return;

                let percent = 0;
                const interval = setInterval(() => {
                  percent = Math.min(100, percent + 8);
                  progress.stack.update(layer, { percent });
                  if (percent >= 100) {
                    clearInterval(interval);
                    void progress.stack
                      .dismiss(layer, undefined as void)
                      .then(() => {
                        pushFeed(setFeed, "Progress", "Upload complete", "ok");
                      });
                  }
                }, 140);
              }}
            >
              Simulate upload
            </Btn>
          </Capability>

          <Capability
            title="useMutationFlow"
            description="Pending state + setRunning while async work runs."
          >
            <Btn
              className="w-full"
              onClick={async () => {
                const ok = await deploy.open({ target: "production" });
                pushFeed(
                  setFeed,
                  "Deploy",
                  ok ? "Deploy succeeded" : "Deploy cancelled",
                  ok ? "ok" : "neutral",
                );
              }}
            >
              Deploy with mutation flow
            </Btn>
          </Capability>

          <Capability
            title="Payload validation"
            description="Bad open() rejects before mount — PayloadValidationError."
          >
            <div className="flex flex-col gap-2">
              <Btn
                variant="primary"
                className="w-full"
                onClick={async () => {
                  setValidationError(null);
                  try {
                    await invite.open({ email: "ops@layers.dev" });
                    pushFeed(setFeed, "Validation", "Invite sent", "ok");
                  } catch (err) {
                    setValidationError(formatValidationError(err));
                  }
                }}
              >
                Valid invite
              </Btn>
              <Btn
                variant="danger"
                className="w-full"
                onClick={async () => {
                  setValidationError(null);
                  try {
                    await invite.open({ email: "not-an-email" });
                  } catch (err) {
                    const msg = formatValidationError(err);
                    setValidationError(msg);
                    pushFeed(setFeed, "Validation", msg, "warn");
                  }
                }}
              >
                Reject bad payload
              </Btn>
              {validationError ? (
                <p className="rounded-[var(--radius-sm)] bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                  {validationError}
                </p>
              ) : null}
            </div>
          </Capability>
        </section>

        <aside
          className="rounded-[var(--radius)] border border-[var(--ink-border)] bg-[var(--ink-panel)] p-5"
          style={{ animation: "fade-up 900ms ease both" }}
        >
          <h2
            className="mb-1 text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Event feed
          </h2>
          <p className="mb-4 text-xs text-[var(--ink-muted)]">
            Results from awaited layers surface here — mirror what DevTools
            shows on the stack timeline.
          </p>
          <ul className="space-y-2">
            {feed.length === 0 ? (
              <li className="rounded-[var(--radius-sm)] border border-dashed border-[var(--ink-border)] px-3 py-6 text-center text-sm text-[var(--ink-muted)]">
                Trigger a capability to populate the feed.
              </li>
            ) : (
              feed.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide ${
                        item.tone === "ok"
                          ? "text-[var(--success)]"
                          : item.tone === "warn"
                            ? "text-[var(--danger)]"
                            : "text-[var(--ink-muted)]"
                      }`}
                    >
                      {item.tone}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                    {item.detail}
                  </p>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
