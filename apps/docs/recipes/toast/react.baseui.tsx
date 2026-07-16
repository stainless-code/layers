import { Toast } from "@base-ui/react/toast";
import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Base UI variant of the toast example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
import { useEffect, useState } from "react";

const toastManager = Toast.createToastManager();

function ToastViewportContent({ onDismiss }: { onDismiss: () => void }) {
  const { toasts } = Toast.useToastManager();

  return (
    <>
      {/* Toast.Provider and Toast.Viewport are usually mounted once at the app root. */}
      <Toast.Portal>
        <Toast.Viewport>
          {toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast}>
              <Toast.Content>
                <Toast.Title>{toast.title}</Toast.Title>
                <Toast.Close aria-label="Dismiss" onClick={onDismiss}>
                  ×
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </>
  );
}

function ToastLayer({
  call,
  payload,
}: LayerComponentProps<{ message: string }, void>) {
  useEffect(() => {
    toastManager.add({ title: payload.message, timeout: 2500 });
    const timer = setTimeout(() => call.dismiss(), 2500);
    return () => clearTimeout(timer);
  }, [call, payload.message]);

  return (
    <Toast.Provider toastManager={toastManager}>
      <ToastViewportContent onDismiss={() => call.dismiss()} />
    </Toast.Provider>
  );
}

const toast = layerOptions<{ message: string }, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: ToastLayer,
});

function Trigger() {
  const client = useLayerClient();
  const [fired, setFired] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void client.open({
            ...toast,
            payload: { message: "Changes saved" },
          });
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
