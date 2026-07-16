import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/preact-layers";
import type { LayerComponentProps } from "@stainless-code/preact-layers";
import { useEffect, useState } from "preact/hooks";

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
  const client = useLayerClient();
  const [fired, setFired] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void client.open({
            ...toast,
            payload: { message: "Changes saved" },
          });
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
