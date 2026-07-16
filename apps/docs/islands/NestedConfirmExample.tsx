export const client = "visible";

import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const enterExit = { enteringDelay: 200, exitingDelay: 200 } as const;

const KEYFRAMES = `
  @keyframes example-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes example-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes example-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes example-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); } }
`;

function Backdrop({
  transition,
  onClick,
  dimmer = "bg-black/40",
  zIndex = "z-[9998]",
}: {
  transition: LayerTransition;
  onClick?: () => void;
  dimmer?: string;
  zIndex?: string;
}) {
  return (
    <div
      className={`fixed inset-0 ${zIndex} ${dimmer} backdrop-blur-sm`}
      style={{
        animation:
          transition === "exiting"
            ? "example-backdrop-out 200ms ease-in forwards"
            : "example-backdrop-in 200ms ease-out forwards",
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function CenterPane({
  transition,
  role,
  zIndex = "z-[9999]",
  children,
}: {
  transition: LayerTransition;
  role?: "dialog" | "alertdialog";
  zIndex?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={role ?? "dialog"}
      aria-modal="true"
      className={`fixed left-1/2 top-1/2 ${zIndex} w-[min(320px,90vw)] rounded-blume border border-border bg-background p-6 shadow-2xl`}
      style={{
        animation:
          transition === "exiting"
            ? "example-dialog-out 200ms ease-in forwards"
            : "example-dialog-in 200ms ease-out forwards",
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

function ChildConfirm({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, boolean>) {
  return overlayPortal(
    <>
      <Backdrop
        transition={transition}
        dimmer="bg-black/25"
        zIndex="z-[10000]"
      />
      <CenterPane transition={transition} role="alertdialog" zIndex="z-[10001]">
        <h3 className="mb-3 text-lg font-semibold text-foreground">
          {payload.title}
        </h3>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => call.end(false)}>No</Btn>
          <Btn kind="danger" onClick={() => call.end(true)}>
            Yes
          </Btn>
        </div>
      </CenterPane>
    </>,
  );
}

const childConfirm = layerOptions<{ title: string }, boolean>({
  key: ["example-nested", "child-confirm"],
  component: ChildConfirm,
  ...enterExit,
});

function ParentDialog({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, void>) {
  const group = useLayerGroup(call, { name: "confirm" });
  const [childResult, setChildResult] = useState<boolean | null>(null);

  return overlayPortal(
    <>
      <Backdrop transition={transition} />
      <CenterPane transition={transition} role="dialog">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
          Remove this item from the list?
        </p>
        <div className="mb-4 flex gap-2">
          <Btn
            kind="primary"
            onClick={async () => {
              setChildResult(null);
              const ok = await group.open({
                ...childConfirm,
                payload: { title: "Really delete this item?" },
              });
              setChildResult(ok);
            }}
          >
            Open child
          </Btn>
          <Btn onClick={() => call.dismiss()}>Close</Btn>
        </div>
        {childResult !== null && (
          <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
            Child result: {String(childResult)}
          </span>
        )}
        <group.Outlet />
      </CenterPane>
    </>,
  );
}

const parentDialog = layerOptions<{ title: string }, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialog,
  ...enterExit,
});

function Trigger() {
  const client = useLayerClient();

  return (
    <button
      type="button"
      className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
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
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-nested" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
