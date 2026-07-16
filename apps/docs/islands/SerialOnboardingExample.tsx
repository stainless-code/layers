export const client = "visible";

import {
  LayerClient,
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerKey,
  LayerState,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const STACK_ID = "example-onboarding";
const enterExit = { enteringDelay: 200, exitingDelay: 200 } as const;

const layerClient = new LayerClient({
  defaultStackOptions: {
    [STACK_ID]: { scope: { strategy: "serial" } },
  },
});

const KEYFRAMES = `
  @keyframes example-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes example-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes example-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes example-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } }
`;

function Backdrop({ transition }: { transition: LayerTransition }) {
  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? "example-backdrop-out 200ms ease-in forwards"
            : "example-backdrop-in 200ms ease-out forwards",
      }}
      aria-hidden="true"
    />
  );
}

function Btn({
  kind = "primary",
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

function OnboardingStep({
  call,
  payload,
  transition,
}: LayerComponentProps<{ step: number; title: string }, void>) {
  return overlayPortal(
    <>
      <Backdrop transition={transition} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Step ${payload.step}`}
        className="fixed left-1/2 top-1/2 z-[9999] w-[min(320px,90vw)] rounded-blume border border-border bg-background p-6 shadow-2xl"
        style={{
          animation:
            transition === "exiting"
              ? "example-dialog-out 200ms ease-in forwards"
              : "example-dialog-in 200ms ease-out forwards",
        }}
      >
        <p className="mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Step {payload.step} of 3
        </p>
        <h2 className="mb-6 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <Btn onClick={() => call.end()}>
          {payload.step < 3 ? "Next" : "Finish"}
        </Btn>
      </div>
    </>,
  );
}

const steps = [
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 1],
    component: OnboardingStep,
    ...enterExit,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 2],
    component: OnboardingStep,
    ...enterExit,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 3],
    component: OnboardingStep,
    ...enterExit,
  }),
];

const stepPayloads = [
  { step: 1, title: "Welcome" },
  { step: 2, title: "Choose preferences" },
  { step: 3, title: "You're all set" },
] as const;

function stepLabel(state: LayerState): string {
  const key = Array.isArray(state.key)
    ? state.key[state.key.length - 1]
    : state.key;
  const payload = state.payload as
    | { step?: number; title?: string }
    | undefined;
  if (payload?.title) return `Step ${payload.step}: ${payload.title}`;
  return `Step ${String(key)}`;
}

function QueueReadout() {
  const client = useLayerClient();
  const stack = client.getStack(STACK_ID);
  const [queued, setQueued] = useState<LayerState[]>([]);

  useEffect(() => {
    const sync = () => setQueued(stack.getQueuedSnapshot());
    sync();
    return stack.subscribe(sync);
  }, [stack]);

  if (queued.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <span className="font-mono text-muted-foreground text-xs">
        Queued: {queued.length}
      </span>
      {queued.map((state) => (
        <div
          key={state.id}
          className="flex items-center justify-between gap-2 rounded-blume border border-dashed border-border bg-muted/20 px-3 py-2 text-sm"
        >
          <span className="truncate text-foreground">{stepLabel(state)}</span>
          <button
            type="button"
            onClick={() =>
              stack.cancelQueued(state.key as LayerKey, undefined as never)
            }
            className="shrink-0 rounded border border-border px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ))}
    </div>
  );
}

function Trigger() {
  const client = useLayerClient();
  const [started, setStarted] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        onClick={() => {
          setStarted(true);
          for (let i = 0; i < steps.length; i++) {
            void client.open({
              ...steps[i],
              payload: stepPayloads[i],
            });
          }
        }}
      >
        Start onboarding
      </button>
      {started && <QueueReadout />}
    </div>
  );
}

export default function SerialOnboardingExample() {
  return (
    <StackProvider client={layerClient}>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack={STACK_ID} />
        <Trigger />
      </div>
    </StackProvider>
  );
}
