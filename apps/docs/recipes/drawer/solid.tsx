import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayer,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal } from "solid-js";

function Drawer(props: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <>
      <div aria-hidden="true" onClick={() => void props.call.end(false)} />
      <div role="dialog" aria-modal="true">
        <h2>{props.payload.title}</h2>
        <p>Edit your settings here. Save or cancel to close the drawer.</p>
        <div>
          <button type="button" onClick={() => void props.call.end(false)}>
            Cancel
          </button>
          <button type="button" onClick={() => void props.call.end(true)}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

const drawer = layerOptions<{ title: string }, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: Drawer,
});

const client = new LayerClient();

function Trigger() {
  const drawerLayer = useLayer(drawer);
  const [result, setResult] = createSignal<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const saved = await drawerLayer.open({ title: "Settings" });
          setResult(saved);
        }}
      >
        Open drawer
      </button>
      {result() !== null && <span>Result: {String(result())}</span>}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-drawer" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
