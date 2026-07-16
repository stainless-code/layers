export const client = "visible";

import {
  LayerClient,
  layerOptions,
  StackProvider,
  StackOutlet,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const ENTER_MS = 200;
const EXIT_MS = 200;

const KEYFRAMES = `
  @keyframes guard-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes guard-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes guard-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes guard-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }
`;

const guardClient = new LayerClient();

function Backdrop({ transition }: { transition: LayerTransition }) {
  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? "guard-backdrop-out 200ms ease-in forwards"
            : "guard-backdrop-in 200ms ease-out forwards",
      }}
      aria-hidden="true"
    />
  );
}

function CenterPane({
  transition,
  children,
}: {
  transition: LayerTransition;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed left-1/2 top-1/2 z-[9999] min-w-[320px] rounded-blume border border-border bg-background p-6 shadow-2xl"
      style={{
        animation:
          transition === "exiting"
            ? "guard-dialog-out 200ms ease-in forwards"
            : "guard-dialog-in 200ms ease-out forwards",
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  kind = "ghost",
  className = "",
  ...props
}: {
  kind?: "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "rounded-blume px-4 py-2 text-sm transition-colors disabled:opacity-50";
  const styles = {
    danger: "bg-red-500 font-medium text-white hover:bg-red-600",
    ghost: "border border-border text-foreground hover:bg-muted",
  } as const;
  return (
    <button
      type="button"
      className={`${base} ${styles[kind]} ${className}`}
      {...props}
    />
  );
}

function GuardDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ destination: string }, boolean>) {
  return overlayPortal(
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition}>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Leave this page?
        </h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
          Unsaved changes may be lost. Navigate to{" "}
          <strong className="text-foreground">{payload.destination}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => call.end(false)}>Stay</Btn>
          <Btn kind="danger" onClick={() => call.end(true)}>
            Leave
          </Btn>
        </div>
      </CenterPane>
    </>,
  );
}

const guard = layerOptions<{ destination: string }, boolean>({
  stack: "example-route-guard",
  key: ["example-route-guard"],
  component: GuardDialog,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

/** Module-level guard — callable from route guards, data loaders, etc. */
export async function confirmLeave(destination: string): Promise<boolean> {
  return guardClient.open({
    ...guard,
    payload: { destination },
  });
}

async function simulateNavigation(destination: string): Promise<string> {
  const ok = await confirmLeave(destination);
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

function Trigger() {
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        onClick={async () => {
          setResult(null);
          const message = await simulateNavigation("/settings");
          setResult(message);
        }}
      >
        Simulate navigation
      </button>
      {result !== null && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          Result: {result}
        </span>
      )}
    </div>
  );
}

export default function RouteGuardExample() {
  return (
    <StackProvider client={guardClient}>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-route-guard" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
