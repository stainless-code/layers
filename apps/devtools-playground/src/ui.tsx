import type { LayerTransition } from "@stainless-code/react-layers";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

/** Keep in sync with `playgroundLayer` delays in `layers.tsx`. */
export const ANIM_MS = 220;

const baseBtn =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45";

const variants = {
  primary: `${baseBtn} bg-[var(--teal)] text-[var(--ink)] hover:brightness-110`,
  ghost: `${baseBtn} border border-[var(--ink-border)] bg-transparent text-[var(--ink-text)] hover:border-[var(--teal-dim)] hover:bg-[var(--teal-glow)]`,
  danger: `${baseBtn} bg-[var(--danger)] text-white hover:brightness-110`,
  subtle: `${baseBtn} bg-[var(--ink-raised)] text-[var(--ink-muted)] hover:text-[var(--ink-text)]`,
} as const;

export function Btn({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      type="button"
      className={`${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/** Enter: closed→rAF→open (avoids waiting out `enteringDelay` invisible). Exit: closed. */
function useTransitionOpen(transition?: LayerTransition): boolean {
  const [open, setOpen] = useState(
    () => transition !== "entering" && transition !== "exiting",
  );

  useEffect(() => {
    if (transition === "settled") {
      setOpen(true);
      return;
    }
    if (transition === "exiting") {
      setOpen(false);
      return;
    }
    if (transition === "entering") {
      setOpen(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setOpen(true);
  }, [transition]);

  return open;
}

export function Backdrop({
  transition,
  onClick,
  className = "",
}: {
  transition?: LayerTransition;
  onClick?: () => void;
  className?: string;
}) {
  const open = useTransitionOpen(transition);
  return (
    <div
      className={`fixed inset-0 z-[9000] bg-black/55 backdrop-blur-[2px] ${className}`}
      style={{
        opacity: open ? 1 : 0,
        transition: `opacity ${ANIM_MS}ms ease`,
      }}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

export function ModalShell({
  transition,
  role = "dialog",
  children,
  className = "",
}: {
  transition?: LayerTransition;
  role?: "dialog" | "alertdialog" | "status";
  children: ReactNode;
  className?: string;
}) {
  const open = useTransitionOpen(transition);
  const style: CSSProperties = {
    opacity: open ? 1 : 0,
    transform: open
      ? "translate(-50%, -50%)"
      : "translate(-50%, calc(-50% + 12px))",
    transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
  };

  return (
    <div
      role={role}
      aria-modal={role !== "status" ? true : undefined}
      className={`fixed left-1/2 top-1/2 z-[9001] w-[min(420px,92vw)] rounded-[var(--radius)] border border-[var(--ink-border)] bg-[var(--ink-panel)] p-6 shadow-[var(--shadow)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function DrawerShell({
  transition,
  children,
}: {
  transition?: LayerTransition;
  children: ReactNode;
}) {
  const open = useTransitionOpen(transition);
  return (
    <>
      <Backdrop transition={transition} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-[9001] flex w-[min(420px,100vw)] flex-col border-l border-[var(--ink-border)] bg-[var(--ink-panel)] shadow-[var(--shadow)]"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {children}
      </div>
    </>
  );
}

export function ToastShell({
  transition,
  children,
}: {
  transition?: LayerTransition;
  children: ReactNode;
}) {
  const open = useTransitionOpen(transition);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex min-w-[280px] max-w-[360px] items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--ink-border)] bg-[var(--ink-panel)] px-4 py-3 shadow-[var(--shadow)]"
      style={{
        opacity: open ? 1 : 0,
        transform: open ? "translateX(0)" : "translateX(16px)",
        transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
      }}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-[var(--radius-sm)] border border-[var(--ink-border)] bg-[var(--ink-raised)] px-3 py-2.5 text-sm text-[var(--ink-text)] outline-none ring-[var(--teal)] focus:border-[var(--teal-dim)] focus:ring-2"
      {...props}
    />
  );
}

export function DialogTitle({
  children,
  kicker,
}: {
  children: ReactNode;
  kicker?: string;
}) {
  return (
    <div className="mb-5">
      {kicker ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
          {kicker}
        </p>
      ) : null}
      <h2
        className="text-xl font-semibold text-[var(--ink-text)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {children}
      </h2>
    </div>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">{children}</div>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-[var(--teal)] border-t-transparent"
      style={{ animation: "spin 700ms linear infinite" }}
      aria-hidden="true"
    />
  );
}
