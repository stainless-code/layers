export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  useStack,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const ENTER_MS = 200;
const EXIT_MS = 200;

const KEYFRAMES = `
  @keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(-120%); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes toast-out { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-120%); } }
`;

let toastCounter = 0;

function Toast({
  call,
  payload,
  transition,
}: LayerComponentProps<{ message: string }, void>) {
  const states = useStack("example-toast");
  const myIndex = states.findIndex((s) => s.id === call.layerId);
  const slot = states.filter(
    (s, i) => i < myIndex && s.transition !== "exiting",
  ).length;

  return overlayPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[9999] rounded-blume border border-border bg-background px-4 py-3 shadow-xl"
      style={{
        top: `${24 + slot * 56}px`,
        left: "50%",
        transition: "top 200ms ease",
        animation:
          transition === "exiting"
            ? `toast-out ${EXIT_MS}ms ease-in forwards`
            : `toast-in 250ms ease-out forwards`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-green-500"
          aria-hidden="true"
        />
        <span className="text-foreground text-sm">{payload.message}</span>
        <button
          type="button"
          onClick={() => call.dismiss()}
          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>,
  );
}

const toast = layerOptions<{ message: string }, void>({
  stack: "example-toast",
  key: ["example-toast"],
  upsert: false,
  component: Toast,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function Trigger() {
  const client = useLayerClient();
  const [fired, setFired] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        onClick={() => {
          toastCounter++;
          const id = toastCounter;
          void client.open({
            ...toast,
            key: ["example-toast", id],
            payload: { message: `Changes saved (#${id})` },
          });
          setFired(true);
        }}
      >
        Show toast
      </button>
      {fired && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          Toast fired
        </span>
      )}
    </div>
  );
}

export default function ToastExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-toast" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
