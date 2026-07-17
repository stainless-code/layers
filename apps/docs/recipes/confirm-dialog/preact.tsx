import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/preact-layers";
import type { LayerComponentProps } from "@stainless-code/preact-layers";
import { useState } from "preact/hooks";

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true">
      <h2>{payload.title}</h2>
      <div>
        <button type="button" onClick={() => void call.end(false)}>
          No
        </button>
        <button type="button" onClick={() => void call.end(true)}>
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

function Trigger() {
  const confirmLayer = useLayer(confirm);
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const ok = await confirmLayer.open({ title: "Delete this file?" });
          setResult(ok);
        }}
      >
        Delete file
      </button>
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-confirm" />
      <Trigger />
    </StackProvider>
  );
}
