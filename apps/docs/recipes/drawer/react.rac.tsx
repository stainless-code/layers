import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// React Aria Components variant of the drawer example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// RAC has no Drawer primitive — Modal + CSS positions a right-side panel.
import { useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

function Drawer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    // apply your own positioning/styling
    <ModalOverlay
      isOpen
      onOpenChange={(o) => {
        if (!o) call.end(false);
      }}
    >
      <Modal>
        <Dialog>
          <Heading slot="title">{payload.title}</Heading>
          <p>Edit your settings here. Save or cancel to close the drawer.</p>
          <div>
            <Button onPress={() => call.end(false)}>Cancel</Button>
            <Button onPress={() => call.end(true)}>Save</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const drawer = layerOptions<{ title: string }, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: Drawer,
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
          const saved = await client.open({
            ...drawer,
            payload: { title: "Settings" },
          });
          setResult(saved);
        }}
      >
        Open drawer
      </button>
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function DrawerExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-drawer" />
      <Trigger />
    </StackProvider>
  );
}
