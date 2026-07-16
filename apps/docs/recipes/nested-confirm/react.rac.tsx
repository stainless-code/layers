import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// React Aria Components variant of the nested-confirm example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
import { useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

function ChildConfirm({
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
          <div>
            <Button onPress={() => call.end(false)}>Cancel</Button>
            <Button onPress={() => call.end(true)}>Confirm</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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
    // apply your own positioning/styling
    <ModalOverlay
      isOpen
      onOpenChange={(o) => {
        if (!o) call.dismiss();
      }}
    >
      <Modal>
        <Dialog>
          <Heading slot="title">{payload.title}</Heading>
          <p>Remove this item from the list?</p>
          <div>
            <Button
              onPress={async () => {
                setChildResult(null);
                const ok = await group.open({
                  ...childConfirm,
                  payload: { title: "Really delete this item?" },
                });
                setChildResult(ok);
              }}
            >
              Delete item
            </Button>
            <Button onPress={() => call.dismiss()}>Close</Button>
          </div>
          {childResult !== null && (
            <span>Child result: {String(childResult)}</span>
          )}
          <group.Outlet />
        </Dialog>
      </Modal>
    </ModalOverlay>
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
