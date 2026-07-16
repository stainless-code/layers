import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// React Aria Components variant of the confirm-dialog example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Instant dismiss: confirm ends the layer synchronously (no exit animation). For animated exits, defer call.end until the exit transition completes — see AnimatedEnterExitExample.rac.tsx.
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
      // Confirm dismiss is instant on purpose; animated recipes must defer call.end (see AnimatedEnterExitExample.rac.tsx).
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
