import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect } from "react";

function ToastLayer({
  call,
  payload,
}: LayerComponentProps<{ message: string }, void>) {
  useEffect(() => {
    const t = setTimeout(() => call.dismiss(), 2500);
    return () => clearTimeout(t);
  }, [call]);
  return <div role="status">{payload.message}</div>;
}

const toast = layerOptions<{ message: string }, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: ToastLayer,
});

function Trigger() {
  const toastLayer = useLayer(toast);
  const show = () => {
    // fire-and-forget — do not await
    void toastLayer.open({ message: "Changes saved" });
  };
  return <button onClick={show}>Show toast</button>;
}

export default function ToastWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-toast" />
      <Trigger />
    </StackProvider>
  );
}
