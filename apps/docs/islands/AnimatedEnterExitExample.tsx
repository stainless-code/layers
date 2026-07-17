export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

import { overlayPortal } from "./_overlayPortal";

function Btn({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-blume border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted ${className}`}
      {...props}
    />
  );
}

function AnimatedDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, void>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (transition === "entering") {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    if (transition === "settled") {
      setVisible(true);
    }
    if (transition === "exiting") {
      setVisible(false);
    }
  }, [transition]);

  const settleIfAnimating = (event: React.TransitionEvent) => {
    if (event.propertyName !== "opacity") return;
    if (transition === "entering" || transition === "exiting") {
      call.settle();
    }
  };

  return overlayPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
        aria-hidden="true"
        onTransitionEnd={settleIfAnimating}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[9999] min-w-[320px] rounded-blume border border-border bg-background p-6 shadow-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translate(-50%, -50%)"
            : "translate(-50%, calc(-50% + 12px))",
          transition: "opacity 200ms ease, transform 200ms ease",
        }}
        onTransitionEnd={settleIfAnimating}
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
          Watch the enter and exit animation. Close to see the exit transition.
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => void call.dismiss()}>Close</Btn>
        </div>
        <p className="mt-4 font-mono text-muted-foreground text-xs">
          transition: {transition}
        </p>
      </div>
    </>,
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
  const animatedLayer = useLayer(animated);
  const [status, setStatus] = useState<"idle" | "open" | "closed">("idle");

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        onClick={() => {
          setStatus("open");
          void animatedLayer.open({ title: "Animated dialog" }).then(() => {
            setStatus("closed");
          });
        }}
      >
        Open animated dialog
      </button>
      {status !== "idle" && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          {status === "open" ? "Open" : "Closed (exit animated)"}
        </span>
      )}
    </div>
  );
}

export default function AnimatedEnterExitExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <StackOutlet stack="example-animated" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
