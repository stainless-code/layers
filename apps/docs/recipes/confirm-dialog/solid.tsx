import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal } from "solid-js";

function ConfirmDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true">
      <h2>{props.payload.title}</h2>
      <div>
        <button type="button" onClick={() => void props.call.end(false)}>
          No
        </button>
        <button type="button" onClick={() => void props.call.end(true)}>
          Yes
        </button>
      </div>
    </div>
  );
}

const confirm = layerOptions<{ title: string }, boolean>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmDialog,
});

const client = new LayerClient();

function Trigger() {
  const c = useLayerClient();
  const [result, setResult] = createSignal<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const ok = await c.open({
            ...confirm,
            payload: { title: "Delete this file?" },
          });
          setResult(ok);
        }}
      >
        Delete file
      </button>
      {result() !== null && <span>Result: {String(result())}</span>}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-confirm" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
