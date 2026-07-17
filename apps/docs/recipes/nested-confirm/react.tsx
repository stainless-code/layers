import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useState } from "react";

function ChildConfirm({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true">
      <h3>{payload.title}</h3>
      <div>
        <button type="button" onClick={() => void call.end(false)}>
          Cancel
        </button>
        <button type="button" onClick={() => void call.end(true)}>
          Confirm
        </button>
      </div>
    </div>
  );
}

const childConfirm = layerOptions<{ title: string }, boolean>({
  key: ["example-nested", "child-confirm"],
  component: ChildConfirm,
});

function ParentDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, void>) {
  const group = useLayerGroup(call);
  const [childResult, setChildResult] = useState<boolean | null>(null);

  return (
    <div role="dialog" aria-modal="true" aria-label={payload.title}>
      <h2>{payload.title}</h2>
      <p>Remove this item from the list?</p>
      <div>
        <button
          type="button"
          onClick={async () => {
            setChildResult(null);
            const ok = await group.open({
              ...childConfirm,
              payload: { title: "Really delete this item?" },
            });
            setChildResult(ok);
          }}
        >
          Delete item
        </button>
        <button type="button" onClick={() => void call.dismiss()}>
          Close
        </button>
      </div>
      {childResult !== null && <span>Child result: {String(childResult)}</span>}
      <group.Outlet />
    </div>
  );
}

const parentDialog = layerOptions<{ title: string }, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialog,
});

function Trigger() {
  const parent = useLayer(parentDialog);

  return (
    <button
      type="button"
      onClick={() => {
        void parent.open({ title: "Edit item" });
      }}
    >
      Open parent dialog
    </button>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-nested" />
      <Trigger />
    </StackProvider>
  );
}
