import {
  isLayerCancelledError,
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

function DiscardLayer({
  call,
  payload,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <div role="alertdialog" aria-modal="true" aria-label={payload.title}>
      <p>{payload.message}</p>
      <button onClick={() => call.end(true)}>Discard</button>
      <button onClick={() => call.end(false)}>Keep editing</button>
    </div>
  );
}

const discardConfirm = layerOptions<
  { title: string; message: string },
  boolean
>({
  key: ["example-blockers-force", "discard"],
  component: DiscardLayer,
});

function EditLayer({
  call,
  payload,
  dismissing,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call, { name: "discard" });
  const [text, setText] = useState("");
  const dirty = text.length > 0;

  useEffect(() => call.addBlocker(() => !dirty), [call, dirty]);

  const attemptClose = async () => {
    if (!dirty) {
      call.end(false);
      return;
    }
    try {
      const discard = await group.open({
        ...discardConfirm,
        payload: {
          title: "Discard changes?",
          message: "You'll lose unsaved edits.",
        },
      });
      if (discard) call.end(false, { force: true }); // force bypasses blockers
    } catch (error) {
      if (!isLayerCancelledError(error)) throw error;
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={payload.title}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={dismissing}
      />
      <button onClick={() => void attemptClose()}>Close</button>
      <button onClick={() => call.end(true, { force: true })}>
        Force save
      </button>
      <group.Outlet />
    </div>
  );
}

const edit = layerOptions<{ title: string }, boolean>({
  stack: "example-blockers-force",
  key: ["example-blockers-force", "parent"],
  component: EditLayer,
});

function Trigger() {
  const editLayer = useLayer(edit);
  const open = () => editLayer.open({ title: "Edit profile" });
  return <button onClick={open}>Open form</button>;
}

export default function BlockersForceWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-blockers-force" />
      <Trigger />
    </StackProvider>
  );
}
