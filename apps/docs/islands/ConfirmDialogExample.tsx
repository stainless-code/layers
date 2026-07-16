export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
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
  @keyframes confirm-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes confirm-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes confirm-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes confirm-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } }
`;

function Backdrop({
  transition,
  onClick,
}: {
  transition: LayerTransition;
  onClick?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      style={{
        animation:
          transition === "exiting"
            ? `confirm-backdrop-out ${EXIT_MS}ms ease-in forwards`
            : `confirm-backdrop-in ${ENTER_MS}ms ease-out forwards`,
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function CenterPane({
  transition,
  role,
  children,
}: {
  transition: LayerTransition;
  role?: "dialog" | "alertdialog";
  children: React.ReactNode;
}) {
  return (
    <div
      role={role ?? "dialog"}
      aria-modal="true"
      className="fixed left-1/2 top-1/2 z-[9999] w-[min(340px,90vw)] rounded-blume border border-border bg-background p-6 shadow-2xl"
      style={{
        animation:
          transition === "exiting"
            ? `confirm-dialog-out ${EXIT_MS}ms ease-in forwards`
            : `confirm-dialog-in 250ms ease-out forwards`,
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
  kind?: "primary" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "rounded-blume px-4 py-2 text-sm transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-accent font-medium text-accent-foreground hover:opacity-90",
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

function ConfirmDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, boolean>) {
  return overlayPortal(
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <CenterPane transition={transition} role="alertdialog">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
          This action cannot be undone. Are you sure you want to continue?
        </p>
        <div className="flex justify-end gap-3">
          <Btn onClick={() => call.end(false)}>No</Btn>
          <Btn kind="danger" onClick={() => call.end(true)}>
            Yes
          </Btn>
        </div>
      </CenterPane>
    </>,
  );
}

const confirm = layerOptions<{ title: string }, boolean>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmDialog,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function Trigger() {
  const client = useLayerClient();
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        onClick={async () => {
          setResult(null);
          const ok = await client.open({
            ...confirm,
            payload: { title: "Delete this file?" },
          });
          setResult(ok);
        }}
      >
        Delete file
      </button>
      {result !== null && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          Result: {String(result)}
        </span>
      )}
    </div>
  );
}

export default function ConfirmDialogExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-confirm" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
