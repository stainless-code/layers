import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayer,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createEffect, createSignal, onCleanup } from "solid-js";

const EXIT_MS = 200;

function AnimatedDialog(props: LayerComponentProps<{ title: string }, void>) {
  createEffect(() => {
    const transition = props.transition;
    if (transition === "entering" || transition === "exiting") {
      const timer = setTimeout(() => props.call.settle(), EXIT_MS);
      onCleanup(() => clearTimeout(timer));
    }
  });

  return (
    <div role="dialog" aria-modal="true">
      <h2>{props.payload.title}</h2>
      <p>
        Watch the enter and exit animation. Close to see the exit transition.
      </p>
      <div>
        <button type="button" onClick={() => void props.call.dismiss()}>
          Close
        </button>
      </div>
      <p>transition: {props.transition}</p>
    </div>
  );
}

const animated = layerOptions<{ title: string }, void>({
  stack: "example-animated",
  key: ["example-animated"],
  component: AnimatedDialog,
  enteringDelay: EXIT_MS,
  exitingDelay: EXIT_MS,
});

const client = new LayerClient();

function Trigger() {
  const animatedLayer = useLayer(animated);
  const [status, setStatus] = createSignal<"idle" | "open" | "closed">("idle");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStatus("open");
          void animatedLayer.open({ title: "Animated dialog" }).then(() => {
            setStatus("closed");
          });
        }}
      >
        Open animated dialog
      </button>
      {status() !== "idle" && (
        <span>{status() === "open" ? "Open" : "Closed (exit animated)"}</span>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-animated" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
