import { Dialog } from "@base-ui/react/dialog";
import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Base UI variant of the confirm-dialog example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Strategy A: controlled `open` -> onOpenChange -> onOpenChangeComplete -> call.end,
// so Base UI's exit animation finishes before Layers unmounts the layer.
import { useRef, useState } from "react";

function ConfirmDialog({
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
              No
            </Dialog.Close>
            <Dialog.Close
              onClick={() => {
                resultRef.current = true;
              }}
            >
              Yes
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const confirm = layerOptions<{ title: string }, boolean>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmDialog,
});

function Trigger() {
  const client = useLayerClient();
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const ok = await client.open({
            ...confirm,
            payload: { title: "Delete this file?" },
          });
          setResult(ok);
        }}
      >
        Delete file
      </button>
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function ConfirmDialogExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-confirm" />
      <Trigger />
    </StackProvider>
  );
}
