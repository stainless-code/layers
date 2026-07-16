import { Dialog } from "@base-ui/react/dialog";
import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Base UI variant of the nested-confirm example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Strategy A: controlled `open` -> onOpenChange -> onOpenChangeComplete -> call.end/dismiss,
// so Base UI's exit animation finishes before Layers unmounts the layer.
import { useRef, useState } from "react";

function ChildConfirm({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  const [open, setOpen] = useState(true);
  const resultRef = useRef<boolean | undefined>(undefined);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (resultRef.current === undefined) resultRef.current = false;
          setOpen(false);
        }
      }}
      onOpenChangeComplete={(o) => {
        if (!o) call.end(resultRef.current ?? false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{payload.title}</Dialog.Title>
          <div>
            <Dialog.Close
              onClick={() => {
                resultRef.current = false;
              }}
            >
              Cancel
            </Dialog.Close>
            <Dialog.Close
              onClick={() => {
                resultRef.current = true;
              }}
            >
              Confirm
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
  const [open, setOpen] = useState(true);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setOpen(false);
      }}
      onOpenChangeComplete={(o) => {
        if (!o) call.dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{payload.title}</Dialog.Title>
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
            <Dialog.Close>Close</Dialog.Close>
          </div>
          {childResult !== null && (
            <span>Child result: {String(childResult)}</span>
          )}
          <group.Outlet />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const parentDialog = layerOptions<{ title: string }, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialog,
});

function Trigger() {
  const client = useLayerClient();

  return (
    <button
      type="button"
      onClick={() => {
        void client.open({
          ...parentDialog,
          payload: { title: "Edit item" },
        });
      }}
    >
      Open parent dialog
    </button>
  );
}

export default function NestedConfirmExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-nested" />
      <Trigger />
    </StackProvider>
  );
}
