import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useState } from "react";

function ProgressOverlay({
  payload,
}: LayerComponentProps<{ percent: number; label: string }, void>) {
  return (
    <div role="dialog" aria-modal="true" aria-label={payload.label}>
      <p>{payload.label}</p>
      <progress value={payload.percent} max={100} />
      <p>{payload.percent}%</p>
    </div>
  );
}

const progress = layerOptions<{ percent: number; label: string }, void>({
  stack: "example-progress",
  key: ["example-progress"],
  component: ProgressOverlay,
});

function Trigger() {
  const progressLayer = useLayer(progress);
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");

  return (
    <div>
      <button
        type="button"
        disabled={status === "running"}
        onClick={() => {
          setStatus("running");
          void progressLayer.open({ percent: 0, label: "Uploading file…" });
          const layer = progressLayer.stack.find(["example-progress"]);
          if (!layer) {
            setStatus("idle");
            return;
          }

          let percent = 0;
          const interval = setInterval(() => {
            percent = Math.min(100, percent + 5);
            progressLayer.stack.update(layer, { percent });
            if (percent >= 100) {
              clearInterval(interval);
              void progressLayer.stack
                .dismiss(layer, undefined as void)
                .then(() => {
                  setStatus("complete");
                });
            }
          }, 150);
        }}
      >
        Start upload
      </button>
      {status !== "idle" && (
        <span>{status === "running" ? "Uploading…" : "Complete"}</span>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-progress" />
      <Trigger />
    </StackProvider>
  );
}
