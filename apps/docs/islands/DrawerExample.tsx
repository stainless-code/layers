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

const enterExit = { enteringDelay: 200, exitingDelay: 200 } as const;

const KEYFRAMES = `
  @keyframes example-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes example-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes example-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes example-drawer-out { from { transform: translateX(0); } to { transform: translateX(100%); } }
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
            ? "example-backdrop-out 200ms ease-in forwards"
            : "example-backdrop-in 200ms ease-out forwards",
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

function Btn({
  kind = "ghost",
  className = "",
  ...props
}: {
  kind?: "primary" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "rounded-blume px-4 py-2 text-sm transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-accent font-medium text-accent-foreground hover:opacity-90",
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

function Drawer({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, boolean>) {
  return overlayPortal(
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed top-0 right-0 z-[9999] flex h-full w-[min(360px,90vw)] flex-col rounded-blume border border-border bg-background p-6 shadow-2xl"
        style={{
          borderRadius:
            "var(--blume-radius, 12px) 0 0 var(--blume-radius, 12px)",
          animation:
            transition === "exiting"
              ? "example-drawer-out 200ms ease-in forwards"
              : "example-drawer-in 200ms ease-out forwards",
        }}
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-6 flex-1 text-muted-foreground text-sm leading-relaxed">
          Edit your settings here. Save or cancel to close the drawer.
        </p>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => call.end(false)}>Cancel</Btn>
          <Btn kind="primary" onClick={() => call.end(true)}>
            Save
          </Btn>
        </div>
      </div>
    </>,
  );
}

const drawer = layerOptions<{ title: string }, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: Drawer,
  ...enterExit,
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
          const saved = await client.open({
            ...drawer,
            payload: { title: "Settings" },
          });
          setResult(saved);
        }}
      >
        Open drawer
      </button>
      {result !== null && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          Result: {String(result)}
        </span>
      )}
    </div>
  );
}

export default function DrawerExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-drawer" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
