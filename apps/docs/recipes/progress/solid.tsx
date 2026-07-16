import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal } from "solid-js";

function ProgressOverlay(
  props: LayerComponentProps<{ percent: number; label: string }, void>,
) {
  return (
    <div role="dialog" aria-modal="true" aria-label={props.payload.label}>
      <p>{props.payload.label}</p>
      <progress value={props.payload.percent} max={100} />
      <p>{props.payload.percent}%</p>
    </div>
  );
}

const progress = layerOptions<{ percent: number; label: string }, void>({
  stack: "example-progress",
  key: ["example-progress"],
  component: ProgressOverlay,
});

const client = new LayerClient();

function Trigger() {
  const c = useLayerClient();
  const [status, setStatus] = createSignal<"idle" | "running" | "complete">(
    "idle",
  );

  return (
    <div>
      <button
        type="button"
        disabled={status() === "running"}
        onClick={() => {
          setStatus("running");
          const stack = c.getStack("example-progress");
          void c.open({
            ...progress,
            payload: { percent: 0, label: "Uploading file…" },
          });
          const layer = stack.find(["example-progress"]);
          if (!layer) {
            setStatus("idle");
            return;
          }

          let percent = 0;
          const interval = setInterval(() => {
            percent = Math.min(100, percent + 5);
            stack.update(layer, { percent });
            if (percent >= 100) {
              clearInterval(interval);
              void stack.dismiss(layer, undefined as void).then(() => {
                setStatus("complete");
              });
            }
          }, 150);
        }}
      >
        Start upload
      </button>
      {status() !== "idle" && (
        <span>{status() === "running" ? "Uploading…" : "Complete"}</span>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-progress" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
