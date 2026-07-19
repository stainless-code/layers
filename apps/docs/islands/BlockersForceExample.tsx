export const client = "visible";

import {
  isLayerCancelledError,
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
  useLayerGroup,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

import { overlayPortal } from "./_overlayPortal";

const ENTER_MS = 200;
const EXIT_MS = 200;

const KEYFRAMES = `
  @keyframes blocker-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes blocker-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes blocker-dialog-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  @keyframes blocker-dialog-out { from { opacity: 1; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }
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
            ? `blocker-backdrop-out ${EXIT_MS}ms ease-in forwards`
            : `blocker-backdrop-in ${ENTER_MS}ms ease-out forwards`,
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
      className="fixed left-1/2 top-1/2 z-[9999] w-[min(360px,90vw)] rounded-blume border border-border bg-background p-6 shadow-2xl"
      style={{
        animation:
          transition === "exiting"
            ? `blocker-dialog-out ${EXIT_MS}ms ease-in forwards`
            : `blocker-dialog-in 250ms ease-out forwards`,
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

function DiscardConfirm({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return overlayPortal(
    <>
      <Backdrop transition={transition} onClick={() => call.end(false)} />
      <CenterPane transition={transition} role="alertdialog">
        <h2 className="mb-2 text-base font-semibold text-foreground">
          {payload.title}
        </h2>
        <p className="mb-5 text-muted-foreground text-sm">{payload.message}</p>
        <div className="flex justify-end gap-2.5">
          <Btn onClick={() => call.end(false)}>Cancel</Btn>
          <Btn kind="primary" onClick={() => call.end(true)}>
            Discard
          </Btn>
        </div>
      </CenterPane>
    </>,
  );
}

const discardConfirm = layerOptions<
  { title: string; message: string },
  boolean
>({
  key: ["example-blockers-force", "discard"],
  component: DiscardConfirm,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function EditDialog({
  call,
  payload,
  transition,
  dismissing,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call, { name: "discard" });
  const [text, setText] = useState("");
  const dirty = text.length > 0;

  useEffect(() => call.addBlocker(() => !dirty), [call, dirty]);

  const attemptClose = async () => {
    if (!dirty) {
      call.end(false);
      return;
    }
    try {
      const discard = await group.open({
        ...discardConfirm,
        payload: {
          title: "Discard changes?",
          message: "You'll lose your unsaved edits.",
        },
      });
      if (discard) call.end(false, { force: true });
    } catch (error) {
      if (!isLayerCancelledError(error)) throw error;
    }
  };

  return overlayPortal(
    <>
      <Backdrop transition={transition} onClick={() => void attemptClose()} />
      <CenterPane transition={transition}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {payload.title}
          </h2>
          {dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              unsaved
            </span>
          )}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          A blocker vetoes call.end/dismiss while there are unsaved edits.
          Backdrop and Close open a discard confirm when dirty; force bypasses
          the blocker.
        </p>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Display name
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type to make the form dirty…"
          className="mb-2 w-full rounded-blume border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
        />

        {dismissing && (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            blocker consulted → vetoed
          </p>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <Btn
            kind="ghost"
            onClick={() => call.end(true, { force: true })}
            className="text-amber-600 dark:text-amber-400"
          >
            Force close
          </Btn>
          <Btn kind="primary" onClick={() => void attemptClose()}>
            Close
          </Btn>
        </div>
        <group.Outlet />
      </CenterPane>
    </>,
  );
}

const edit = layerOptions<{ title: string }, boolean>({
  stack: "example-blockers-force",
  key: ["example-blockers-force", "parent"],
  component: EditDialog,
  enteringDelay: ENTER_MS,
  exitingDelay: EXIT_MS,
});

function Trigger() {
  const editLayer = useLayer(edit);
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        className="rounded-blume bg-accent px-5 py-2.5 font-medium text-accent-foreground text-sm transition-opacity hover:opacity-90"
        onClick={async () => {
          setResult(null);
          const ok = await editLayer.open({ title: "Edit profile" });
          setResult(ok);
        }}
      >
        Open form
      </button>
      {result !== null && (
        <span className="inline-block rounded-blume bg-muted px-3 py-1 font-mono text-foreground text-sm">
          Result: {String(result)}
        </span>
      )}
    </div>
  );
}

export default function BlockersForceExample() {
  return (
    <StackProvider>
      <div className="not-prose">
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <StackOutlet stack="example-blockers-force" />
        <Trigger />
      </div>
    </StackProvider>
  );
}
