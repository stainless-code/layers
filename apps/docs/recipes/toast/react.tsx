import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

function Toast({
  call,
  payload,
}: LayerComponentProps<{ message: string }, void>) {
  useEffect(() => {
    const timer = setTimeout(() => call.dismiss(), 2500);
    return () => clearTimeout(timer);
  }, [call]);

  return (
    <div role="status" aria-live="polite">
      <span>{payload.message}</span>
      <button type="button" onClick={() => call.dismiss()} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

const toast = layerOptions<{ message: string }, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: Toast,
});

function Trigger() {
  const toastLayer = useLayer(toast);
  const [fired, setFired] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void toastLayer.open({ message: "Changes saved" });
          setFired(true);
        }}
      >
        Show toast
      </button>
      {fired && <span>Toast fired</span>}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-toast" />
      <Trigger />
    </StackProvider>
  );
}
