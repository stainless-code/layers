import { Dialog } from "@base-ui/react/dialog";
import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Base UI variant of the animated-enter-exit example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Strategy A: Base UI's onOpenChangeComplete replaces Layers' transition/settle
// for exit timing — call.end runs after the CSS exit animation finishes.
import { useState } from "react";

function AnimatedDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, void>) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setOpen(false);
      }}
      onOpenChangeComplete={(o) => {
        if (!o) call.end();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{payload.title}</Dialog.Title>
          <Dialog.Description>
            Watch the enter and exit animation. Close to see the exit
            transition.
          </Dialog.Description>
          <div>
            <Dialog.Close>Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const animated = layerOptions<{ title: string }, void>({
  stack: "example-animated",
  key: ["example-animated"],
  component: AnimatedDialog,
  enteringDelay: 200,
  exitingDelay: 200,
});

function Trigger() {
  const client = useLayerClient();
  const [status, setStatus] = useState<"idle" | "open" | "closed">("idle");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStatus("open");
          void client
            .open({
              ...animated,
              payload: { title: "Animated dialog" },
            })
            .then(() => {
              setStatus("closed");
            });
        }}
      >
        Open animated dialog
      </button>
      {status !== "idle" && (
        <span>{status === "open" ? "Open" : "Closed (exit animated)"}</span>
      )}
    </div>
  );
}

export default function AnimatedEnterExitExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-animated" />
      <Trigger />
    </StackProvider>
  );
}
