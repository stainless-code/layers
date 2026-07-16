import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

function ChildLayer({
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

const childConfirm = layerOptions<{ title: string }, boolean>({
  key: ["example-nested", "child-confirm"],
  component: ChildLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

function ParentLayer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, void>) {
  const group = useLayerGroup(call, { name: "confirm" });
  const openChild = async () => {
    await group.open({
      ...childConfirm,
      payload: { title: "Really delete this item?" },
    });
  };
  return (
    <>
      <div role="dialog" aria-modal="true" aria-label={payload.title}>
        <button onClick={openChild}>Delete</button>
        <button onClick={() => call.dismiss()}>Close</button>
      </div>
      <group.Outlet />
    </>
  );
}

const parentDialog = layerOptions<{ title: string }, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

function Trigger() {
  const parent = useLayer(parentDialog);
  const open = () => parent.open({ title: "Edit item" });
  return <button onClick={open}>Open parent dialog</button>;
}

export default function NestedConfirmWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-nested" />
      <Trigger />
    </StackProvider>
  );
}
