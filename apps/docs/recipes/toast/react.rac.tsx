import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// UNSTABLE_Toast* is the 1.19 export prefix (stable in 3.x).
// RAC also ships a global ToastQueue — don't dual-queue with Layers.
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";

function ToastLayer({
  call,
  payload,
}: LayerComponentProps<{ message: string }, void>) {
  const queue = useMemo(() => {
    const q = new ToastQueue<{ title: string }>();
    q.add({ title: payload.message });
    return q;
  }, [payload.message]);

  useEffect(() => {
    const timer = setTimeout(() => call.dismiss(), 2500);
    return () => clearTimeout(timer);
  }, [call]);

  return (
    <>
      {/* ToastRegion is usually mounted once at the app root. */}
      <ToastRegion queue={queue}>
        {({ toast }) => (
          <Toast toast={toast}>
            <ToastContent>
              <Text slot="title">{payload.message}</Text>
            </ToastContent>
            <Button
              slot="close"
              aria-label="Dismiss"
              onPress={() => call.dismiss()}
            >
              ×
            </Button>
          </Toast>
        )}
      </ToastRegion>
    </>
  );
}

const toast = layerOptions<{ message: string }, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: ToastLayer,
});

function Trigger() {
  const toastLayer = useLayer(toast);
  const [fired, setFired] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void toastLayer.open({ message: "Changes saved" });
          setFired(true);
        }}
      >
        Show toast
      </button>
      {fired && <span>Toast fired</span>}
    </div>
  );
}

export default function ToastExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-toast" />
      <Trigger />
    </StackProvider>
  );
}
