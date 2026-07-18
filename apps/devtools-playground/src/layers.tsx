import {
  isPayloadValidationError,
  layerOptions,
  useLayerGroup,
  useMutationFlow,
} from "@stainless-code/react-layers";
import type {
  LayerComponentProps,
  LayerKey,
  LayerOptions,
  LayerTransition,
} from "@stainless-code/react-layers";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { MODAL_STACK, TOAST_STACK, WIZARD_STACK } from "./client";
import { overlayPortal } from "./portal";
import {
  ANIM_MS,
  Backdrop,
  Btn,
  DialogActions,
  DialogTitle,
  DrawerShell,
  Field,
  ModalShell,
  Spinner,
  TextInput,
  ToastShell,
} from "./ui";

type LayerProps<P, R = void, D = unknown> = LayerComponentProps<P, R, never, D>;

interface TitlePayload {
  title: string;
}

interface ConfirmPayload {
  title: string;
  detail?: string;
}

interface DiscardPayload {
  title: string;
  message: string;
}

interface WizardPayload {
  step: number;
  title: string;
  body: string;
}

interface ProfilePayload {
  userId: string;
}

interface Profile {
  name: string;
  role: string;
  initials: string;
}

interface ToastPayload {
  message: string;
  tone?: "ok" | "warn";
}

interface ProgressPayload {
  percent: number;
  label: string;
}

interface DeployPayload {
  target: string;
}

interface InvitePayload {
  email: string;
}

function playgroundKey(...parts: Array<string | number>): LayerKey {
  return ["playground", ...parts];
}

function playgroundLayer<
  P,
  R = void,
  E = never,
  D = unknown,
  RootProps = unknown,
  const Key extends LayerKey = LayerKey,
>(options: LayerOptions<P, R, E, D, RootProps> & { key: Key }) {
  return layerOptions<P, R, E, D, RootProps, Key>({
    stack: MODAL_STACK,
    enteringDelay: ANIM_MS,
    exitingDelay: ANIM_MS,
    ...options,
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function useSettleOnTransition(
  call: { settle: () => void },
  transition: LayerTransition,
) {
  useEffect(() => {
    if (transition !== "entering" && transition !== "exiting") {
      return;
    }
    const timer = setTimeout(() => call.settle(), ANIM_MS);
    return () => clearTimeout(timer);
  }, [transition, call]);
}

function ModalOverlay(props: {
  transition: LayerTransition;
  role?: "dialog" | "alertdialog" | "status";
  onBackdropClick?: () => void;
  children: ReactNode;
}) {
  return overlayPortal(
    <>
      <Backdrop transition={props.transition} onClick={props.onBackdropClick} />
      <ModalShell transition={props.transition} role={props.role}>
        {props.children}
      </ModalShell>
    </>,
  );
}

function Muted({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-sm leading-relaxed text-[var(--ink-muted)] ${className}`}
    >
      {children}
    </p>
  );
}

function BooleanActions(props: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
}) {
  return (
    <DialogActions>
      <Btn onClick={props.onCancel}>{props.cancelLabel ?? "Cancel"}</Btn>
      <Btn variant={props.confirmVariant ?? "danger"} onClick={props.onConfirm}>
        {props.confirmLabel ?? "Confirm"}
      </Btn>
    </DialogActions>
  );
}

function ConfirmDialog({
  call,
  payload,
  transition,
}: LayerProps<ConfirmPayload, boolean>) {
  return (
    <ModalOverlay
      transition={transition}
      role="alertdialog"
      onBackdropClick={() => call.end(false)}
    >
      <DialogTitle kicker="Confirm">{payload.title}</DialogTitle>
      <Muted>
        {payload.detail ??
          "This action cannot be undone. Proceed only if you are certain."}
      </Muted>
      <BooleanActions
        onCancel={() => call.end(false)}
        onConfirm={() => call.end(true)}
      />
    </ModalOverlay>
  );
}

export const confirmLayer = playgroundLayer<ConfirmPayload, boolean>({
  key: playgroundKey("confirm"),
  component: ConfirmDialog,
});

function WizardStep({ call, payload, transition }: LayerProps<WizardPayload>) {
  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker={`Step ${payload.step} of 3`}>
        {payload.title}
      </DialogTitle>
      <Muted>{payload.body}</Muted>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--ink-raised)]">
        <div
          className="h-full rounded-full bg-[var(--teal)] transition-all duration-300"
          style={{ width: `${(payload.step / 3) * 100}%` }}
        />
      </div>
      <DialogActions>
        <Btn variant="primary" onClick={() => call.end()}>
          {payload.step < 3 ? "Continue" : "Finish"}
        </Btn>
      </DialogActions>
    </ModalOverlay>
  );
}

export const wizardPayloads = [
  {
    step: 1,
    title: "Welcome to Layers",
    body: "Serial scope queues overlays — only one wizard step mounts at a time.",
  },
  {
    step: 2,
    title: "Compose stacks",
    body: "Modal, toast, and wizard stacks run in parallel across the app surface.",
  },
  {
    step: 3,
    title: "Ship with confidence",
    body: "Await results, block dismissals, and inspect everything in DevTools.",
  },
] as const satisfies readonly WizardPayload[];

export const wizardSteps = wizardPayloads.map((step) =>
  playgroundLayer<WizardPayload>({
    stack: WIZARD_STACK,
    key: playgroundKey("wizard", step.step),
    component: WizardStep,
  }),
);

function NestedChildConfirm({
  call,
  payload,
  transition,
}: LayerProps<TitlePayload, boolean>) {
  return (
    <ModalOverlay transition={transition} role="alertdialog">
      <DialogTitle kicker="Nested">{payload.title}</DialogTitle>
      <Muted>
        Child overlay on a scoped stack — parent stays mounted underneath.
      </Muted>
      <BooleanActions
        cancelLabel="Back"
        confirmLabel="Delete"
        onCancel={() => call.end(false)}
        onConfirm={() => call.end(true)}
      />
    </ModalOverlay>
  );
}

const nestedChild = playgroundLayer<TitlePayload, boolean>({
  key: playgroundKey("nested", "child"),
  component: NestedChildConfirm,
});

function NestedParentDialog({
  call,
  payload,
  transition,
}: LayerProps<TitlePayload>) {
  const group = useLayerGroup(call);
  const [childResult, setChildResult] = useState<boolean | null>(null);

  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Parent layer">{payload.title}</DialogTitle>
      <Muted className="mb-4">
        Open a nested confirm without tearing down this dialog.
      </Muted>
      {childResult !== null ? (
        <p className="mb-4 rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-2 text-sm text-[var(--success)]">
          Child returned: {String(childResult)}
        </p>
      ) : null}
      <DialogActions>
        <Btn
          variant="danger"
          onClick={async () => {
            setChildResult(null);
            const ok = await group.open({
              ...nestedChild,
              payload: { title: "Really delete deployment?" },
            });
            setChildResult(ok);
          }}
        >
          Delete deployment
        </Btn>
        <Btn onClick={() => call.dismiss()}>Close</Btn>
      </DialogActions>
      <group.Outlet />
    </ModalOverlay>
  );
}

export const nestedParentLayer = playgroundLayer<TitlePayload>({
  key: playgroundKey("nested", "parent"),
  component: NestedParentDialog,
});

function DiscardConfirm({
  call,
  payload,
  transition,
}: LayerProps<DiscardPayload, boolean>) {
  return (
    <ModalOverlay transition={transition} role="alertdialog">
      <DialogTitle>{payload.title}</DialogTitle>
      <Muted>{payload.message}</Muted>
      <BooleanActions
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        onCancel={() => call.end(false)}
        onConfirm={() => call.end(true)}
      />
    </ModalOverlay>
  );
}

const discardConfirm = playgroundLayer<DiscardPayload, boolean>({
  key: playgroundKey("blockers", "discard"),
  component: DiscardConfirm,
});

function BlockedEditDialog({
  call,
  payload,
  transition,
  dismissing,
}: LayerProps<TitlePayload, boolean>) {
  const group = useLayerGroup(call, { name: "discard" });
  const [text, setText] = useState("");
  const dirty = text.trim().length > 0;

  useEffect(() => call.addBlocker(() => !dirty), [call, dirty]);

  const attemptClose = async () => {
    if (!dirty) {
      call.end(false);
      return;
    }
    const discard = await group.open({
      ...discardConfirm,
      payload: {
        title: "Discard changes?",
        message: "Unsaved edits will be lost.",
      },
    });
    if (discard) call.end(false, { force: true });
  };

  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Blockers">{payload.title}</DialogTitle>
      <Field label="Deployment notes">
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type to mark the form dirty…"
          autoFocus
        />
      </Field>
      {dismissing ? (
        <p className="mb-3 text-xs text-[var(--teal)]">
          Blocker consulted — dismiss vetoed until you confirm or force close.
        </p>
      ) : null}
      <DialogActions>
        <Btn onClick={() => void attemptClose()}>Close</Btn>
        <Btn variant="subtle" onClick={() => call.end(true, { force: true })}>
          Force close
        </Btn>
      </DialogActions>
      <group.Outlet />
    </ModalOverlay>
  );
}

export const blockedEditLayer = playgroundLayer<TitlePayload, boolean>({
  key: playgroundKey("blockers", "edit"),
  component: BlockedEditDialog,
});

function ProfileDialog({
  call,
  payload,
  data,
  phase,
  transition,
}: LayerProps<ProfilePayload, void, Profile>) {
  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Async loadFn">
        Profile · {payload.userId}
      </DialogTitle>
      {phase === "pending" ? (
        <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
          <Spinner />
          Loading profile before mount settles…
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--teal-glow)] text-lg font-semibold text-[var(--teal)]">
            {data?.initials}
          </div>
          <div>
            <p className="font-medium">{data?.name}</p>
            <p className="text-sm text-[var(--ink-muted)]">{data?.role}</p>
          </div>
        </div>
      )}
      <DialogActions>
        <Btn onClick={() => call.dismiss()}>Close</Btn>
      </DialogActions>
    </ModalOverlay>
  );
}

export const profileLayer = playgroundLayer<
  ProfilePayload,
  void,
  never,
  Profile
>({
  key: playgroundKey("async-profile"),
  component: ProfileDialog,
  loadFn: async ({ signal }) => {
    await delay(900, signal);
    return {
      name: "Ada Lovelace",
      role: "Founding Engineer",
      initials: "AL",
    };
  },
});

function AnimatedDialog({
  call,
  payload,
  transition,
}: LayerProps<TitlePayload>) {
  useSettleOnTransition(call, transition);

  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Transitions">{payload.title}</DialogTitle>
      <Muted>
        enteringDelay / exitingDelay hold the layer until{" "}
        <code className="text-[var(--teal)]">call.settle()</code> runs.
      </Muted>
      <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-2 text-xs text-[var(--ink-muted)]">
        transition:{" "}
        <strong className="text-[var(--ink-text)]">{transition}</strong>
      </p>
      <DialogActions>
        <Btn onClick={() => call.dismiss()}>Close</Btn>
      </DialogActions>
    </ModalOverlay>
  );
}

export const animatedLayer = playgroundLayer<TitlePayload>({
  key: playgroundKey("animated"),
  component: AnimatedDialog,
});

function SettingsDrawer({
  call,
  payload,
  transition,
}: LayerProps<TitlePayload, boolean>) {
  return overlayPortal(
    <DrawerShell transition={transition}>
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] px-6 py-5">
        <DialogTitle>{payload.title}</DialogTitle>
        <Btn
          variant="subtle"
          aria-label="Close drawer"
          onClick={() => call.end(false)}
        >
          ✕
        </Btn>
      </div>
      <div className="flex-1 space-y-4 overflow-auto px-6 py-5 text-sm text-[var(--ink-muted)]">
        <p>
          Side-panel layer on the modal stack — backdrop + sheet chrome you own.
        </p>
        <Field label="Stack name">
          <TextInput defaultValue="production-modal" />
        </Field>
        <Field label="Region">
          <TextInput defaultValue="us-east-1" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--ink-border)] px-6 py-4">
        <Btn onClick={() => call.end(false)}>Cancel</Btn>
        <Btn variant="primary" onClick={() => call.end(true)}>
          Save
        </Btn>
      </div>
    </DrawerShell>,
  );
}

export const drawerLayer = playgroundLayer<TitlePayload, boolean>({
  key: playgroundKey("drawer"),
  component: SettingsDrawer,
});

function ToastLayer({ call, payload, transition }: LayerProps<ToastPayload>) {
  useEffect(() => {
    const timer = setTimeout(() => call.dismiss(), 3200);
    return () => clearTimeout(timer);
  }, [call]);

  const tone = payload.tone ?? "ok";

  return (
    <ToastShell transition={transition}>
      <span
        className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === "warn" ? "bg-[var(--danger)]" : "bg-[var(--success)]"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--ink-text)]">
          {payload.message}
        </p>
        <p className="text-xs text-[var(--ink-muted)]">Parallel toast stack</p>
      </div>
      <Btn
        variant="subtle"
        className="px-2 py-1"
        aria-label="Dismiss notification"
        onClick={() => call.dismiss()}
      >
        ✕
      </Btn>
    </ToastShell>
  );
}

export const toastLayer = playgroundLayer<ToastPayload>({
  stack: TOAST_STACK,
  key: playgroundKey("toast"),
  component: ToastLayer,
});

function ProgressOverlay({ payload, transition }: LayerProps<ProgressPayload>) {
  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Long-running">{payload.label}</DialogTitle>
      <div className="space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--ink-raised)]">
          <div
            className="h-full rounded-full bg-[var(--teal)] transition-all duration-150"
            style={{ width: `${payload.percent}%` }}
          />
        </div>
        <Muted>{payload.percent}% complete</Muted>
      </div>
    </ModalOverlay>
  );
}

export const progressLayer = playgroundLayer<ProgressPayload>({
  key: playgroundKey("progress"),
  component: ProgressOverlay,
});

function DeployDialog({
  call,
  payload,
  transition,
}: LayerProps<DeployPayload, boolean>) {
  const flow = useMutationFlow(call);

  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="useMutationFlow">
        Deploy to {payload.target}
      </DialogTitle>
      <Muted>
        Mutation flow sets running state while the async action completes.
      </Muted>
      <DialogActions>
        <Btn onClick={() => call.end(false)} disabled={flow.pending}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          disabled={flow.pending}
          onClick={() =>
            void flow
              .run(async () => {
                await delay(1200);
              })
              .orEnd(true)
          }
        >
          {flow.pending ? (
            <>
              <Spinner /> Deploying…
            </>
          ) : (
            "Deploy"
          )}
        </Btn>
      </DialogActions>
    </ModalOverlay>
  );
}

export const deployLayer = playgroundLayer<DeployPayload, boolean>({
  key: playgroundKey("deploy"),
  component: DeployDialog,
});

function InviteDialog({
  call,
  payload,
  transition,
}: LayerProps<InvitePayload>) {
  return (
    <ModalOverlay transition={transition}>
      <DialogTitle kicker="Validated payload">Send invite</DialogTitle>
      <Muted>Opening with a valid email parsed at the boundary:</Muted>
      <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--ink-raised)] px-3 py-2 text-sm">
        {payload.email}
      </p>
      <DialogActions>
        <Btn onClick={() => call.dismiss()}>Close</Btn>
        <Btn variant="primary" onClick={() => call.end()}>
          Send
        </Btn>
      </DialogActions>
    </ModalOverlay>
  );
}

export const inviteLayer = playgroundLayer<InvitePayload>({
  key: playgroundKey("invite"),
  component: InviteDialog,
  validate: (input: unknown) => {
    const email =
      typeof input === "object" && input !== null && "email" in input
        ? (input as { email: unknown }).email
        : undefined;
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("Valid email required");
    }
    return { email: email.trim().toLowerCase() };
  },
});

export function formatValidationError(err: unknown): string {
  if (isPayloadValidationError(err)) {
    return err.issues.map((i) => i.message).join("; ") || "Invalid payload";
  }
  if (err instanceof Error) return err.message;
  return "Unknown validation error";
}
