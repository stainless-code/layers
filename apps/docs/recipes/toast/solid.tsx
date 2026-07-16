import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayer,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal, onCleanup, onMount } from "solid-js";

function Toast(props: LayerComponentProps<{ message: string }, void>) {
  onMount(() => {
    const timer = setTimeout(() => void props.call.dismiss(), 2500);
    onCleanup(() => clearTimeout(timer));
  });

  return (
    <div role="status" aria-live="polite">
      <span>{props.payload.message}</span>
      <button
        type="button"
        onClick={() => void props.call.dismiss()}
        aria-label="Dismiss"
      >
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

const client = new LayerClient();

function Trigger() {
  const toastLayer = useLayer(toast);
  const [fired, setFired] = createSignal(false);

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
      {fired() && <span>Toast fired</span>}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-toast" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
