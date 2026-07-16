import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// React Aria Components variant of the animated-enter-exit example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Defer call.end until RAC's exit animation completes — do not end instantly on dismiss.
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

const EXIT_MS = 200;

function AnimatedDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, void>) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (exiting) {
      const t = setTimeout(() => call.end(), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [exiting, call]);

  return (
    // apply your own positioning/styling
    <ModalOverlay
      isOpen
      onOpenChange={(o) => {
        if (!o && !exiting) setExiting(true);
      }}
    >
      <Modal>
        <Dialog>
          <Heading slot="title">{payload.title}</Heading>
          <p>
            Watch the enter and exit animation. Close to see the exit
            transition.
          </p>
          <div>
            <Button
              onPress={() => {
                if (!exiting) setExiting(true);
              }}
            >
              Close
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
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
