import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

const EXIT_MS = 200;

function AnimatedDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, void>) {
  useEffect(() => {
    if (transition === "entering" || transition === "exiting") {
      const timer = setTimeout(() => call.settle(), EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [transition, call]);

  return (
    <div role="dialog" aria-modal="true">
      <h2>{payload.title}</h2>
      <p>
        Watch the enter and exit animation. Close to see the exit transition.
      </p>
      <div>
        <button type="button" onClick={() => void call.dismiss()}>
          Close
        </button>
      </div>
      <p>transition: {transition}</p>
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

function Trigger() {
  const animatedLayer = useLayer(animated);
  const [status, setStatus] = useState<"idle" | "open" | "closed">("idle");

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
      {status !== "idle" && (
        <span>{status === "open" ? "Open" : "Closed (exit animated)"}</span>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-animated" />
      <Trigger />
    </StackProvider>
  );
}
