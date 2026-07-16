export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const ENTER_MS = 200;
const EXIT_MS = 200;

const KEYFRAMES = `
  @keyframes progress-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes progress-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes progress-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes progress-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } }
  @keyframes progress-spin { to { transform: rotate(360deg); } }
`;

function Backdrop({ transition }: { transition: LayerTransition }) {
  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? `progress-backdrop-out ${EXIT_MS}ms ease-in forwards`
            : `progress-backdrop-in ${ENTER_MS}ms ease-out forwards`,
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
            ? `progress-dialog-out ${EXIT_MS}ms ease-in forwards`
            : `progress-dialog-in 250ms ease-out forwards`,
      }}
    >
      {children}
    </div>
  );
}

function ProgressOverlay({
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

  return overlayPortal(
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition}>
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
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
          ) : (
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent"
              style={{ animation: "progress-spin 700ms linear infinite" }}
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
            className="h-full rounded-full"
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
    </>,
  );
}

const progress = layerOptions<
  { fileName: string; percent: number; speedKb: number },
  void
>({
  stack: "example-progress",
  key: ["example-progress"],
  upsert: true,
  component: ProgressOverlay,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function Trigger() {
  const client = useLayerClient();
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        disabled={status === "running"}
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        onClick={() => {
          setStatus("running");
          void client.open({
            ...progress,
            payload: {
              fileName: "layers-core-1.4.0.tgz",
              percent: 0,
              speedKb: 0,
            },
          });
          const stack = client.getStack("example-progress");
          const layer = stack.find(["example-progress"]);
          if (!layer) {
            setStatus("idle");
            return;
          }

          let pct = 0;
          const tick = setInterval(() => {
            pct = Math.min(100, pct + Math.round(6 + Math.random() * 8));
            const speed = Math.round((8 + Math.random() * 6) * 10) / 10;
            stack.update(layer, { percent: pct, speedKb: speed } as never);
            stack.setRunning(layer, pct < 100);
            if (pct >= 100) {
              clearInterval(tick);
              setStatus("complete");
            }
          }, 130);
        }}
      >
        Start upload
      </button>
      {status !== "idle" && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          {status === "running" ? "Uploading…" : "Complete"}
        </span>
      )}
    </div>
  );
}

export default function ProgressExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-progress" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
