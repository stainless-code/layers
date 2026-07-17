import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Instant dismiss — call.end on dismiss intent (no exit animation).
import { useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    // apply your own positioning/styling
    <ModalOverlay
      isOpen
      // Instant dismiss — for exit CSS, defer call.end until the animation finishes.
      onOpenChange={(o) => {
        if (!o) call.end(false);
      }}
    >
      <Modal>
        <Dialog>
          <Heading slot="title">{payload.title}</Heading>
          <div>
            <Button onPress={() => call.end(false)}>No</Button>
            <Button onPress={() => call.end(true)}>Yes</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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

export default function ConfirmDialogExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-confirm" />
      <Trigger />
    </StackProvider>
  );
}
