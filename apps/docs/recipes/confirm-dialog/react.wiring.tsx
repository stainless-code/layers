import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

function ConfirmLayer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="alertdialog" aria-modal="true" aria-label={payload.title}>
      <button onClick={() => call.end(true)}>Yes</button>
      <button onClick={() => call.end(false)}>No</button>
    </div>
  );
}

const confirm = layerOptions<{ title: string }, boolean>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmLayer,
});

function Trigger() {
  const confirmLayer = useLayer(confirm);
  const open = () => confirmLayer.open({ title: "Delete this file?" });
  return <button onClick={open}>Delete file</button>;
}

export default function ConfirmWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-confirm" />
      <Trigger />
    </StackProvider>
  );
}
