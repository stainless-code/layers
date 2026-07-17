import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useState } from "react";

function Drawer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <>
      <div aria-hidden="true" onClick={() => void call.end(false)} />
      <div role="dialog" aria-modal="true">
        <h2>{payload.title}</h2>
        <p>Edit your settings here. Save or cancel to close the drawer.</p>
        <div>
          <button type="button" onClick={() => void call.end(false)}>
            Cancel
          </button>
          <button type="button" onClick={() => void call.end(true)}>
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

function Trigger() {
  const drawerLayer = useLayer(drawer);
  const [result, setResult] = useState<boolean | null>(null);

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
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-drawer" />
      <Trigger />
    </StackProvider>
  );
}
