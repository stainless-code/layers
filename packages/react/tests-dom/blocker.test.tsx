import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import {
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Minimal confirm dialog for async blocker flows. */
function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<{ message: string }, boolean>) {
  return (
    <div role="dialog" aria-label="Confirm">
      <p>{payload.message}</p>
      <button type="button" onClick={() => call.end(true)}>
        Yes
      </button>
      <button type="button" onClick={() => call.end(false)}>
        No
      </button>
    </div>
  );
}

const confirmOptions = layerOptions<{ message: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "blocker"],
  component: ConfirmDialog,
  exitingDelay: 0,
});

/** Guarded layer — sync blocker toggled by in-dialog Allow button. */
function GuardedDialog({
  call,
  payload,
  dismissing,
}: LayerComponentProps<{ title: string }, boolean>) {
  const allowRef = useRef(false);
  useEffect(() => {
    const dispose = call.addBlocker(() => allowRef.current);
    return dispose;
  }, [call]);

  return (
    <div
      role="dialog"
      aria-label={payload.title}
      data-dismissing={String(dismissing)}
    >
      <h2>{payload.title}</h2>
      <button type="button" onClick={() => (allowRef.current = true)}>
        Allow
      </button>
      <button type="button" onClick={() => call.end(true)}>
        Close
      </button>
      <button type="button" onClick={() => call.end(true, { force: true })}>
        Force close
      </button>
    </div>
  );
}

const guardedOptions = layerOptions<{ title: string }, boolean>({
  stack: "main",
  key: ["main", "guarded"],
  component: GuardedDialog,
  exitingDelay: 0,
});

/** Async confirm blocker — opens a nested confirm layer when dirty. */
function DirtyFormDialog({
  call,
  payload,
  dismissing,
}: LayerComponentProps<{ title: string; dirty: boolean }, boolean>) {
  const client = useLayerClient();
  const { dirty } = payload;

  useEffect(() => {
    const dispose = call.addBlocker(async () => {
      if (!dirty) return true;
      return client.open({
        ...confirmOptions,
        payload: { message: "Discard changes?" },
      });
    });
    return dispose;
  }, [call, client, dirty]);

  return (
    <div
      role="dialog"
      aria-label={payload.title}
      data-dismissing={String(dismissing)}
    >
      <h2>{payload.title}</h2>
      <button type="button" onClick={() => call.end(true)}>
        Close
      </button>
    </div>
  );
}

const dirtyFormOptions = layerOptions<
  { title: string; dirty: boolean },
  boolean
>({
  stack: "main",
  key: ["main", "dirty-form"],
  component: DirtyFormDialog,
  exitingDelay: 0,
});

function BlockedDialog({
  call,
  payload,
}: LayerComponentProps<{ label: string }, boolean>) {
  useEffect(() => {
    const dispose = call.addBlocker(() => false);
    return dispose;
  }, [call]);

  return (
    <div role="dialog" aria-label={payload.label}>
      <p>{payload.label}</p>
      <button type="button" onClick={() => call.end(true)}>
        Close
      </button>
    </div>
  );
}

const blockedOptions = layerOptions<{ label: string }, boolean>({
  stack: "main",
  key: ["main", "blocked"],
  component: BlockedDialog,
  exitingDelay: 0,
});

const openOptions = layerOptions<{ label: string }, boolean>({
  stack: "main",
  key: ["main", "open"],
  component: ({
    call,
    payload,
  }: LayerComponentProps<{ label: string }, boolean>) => (
    <div role="dialog" aria-label={payload.label}>
      <p>{payload.label}</p>
      <button type="button" onClick={() => call.end(true)}>
        Close
      </button>
    </div>
  ),
  exitingDelay: 0,
});

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="main" />
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

describe("React adapter — blockers", () => {
  it("instance blocker vetoes close until allow flips", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...guardedOptions,
      payload: { title: "Guarded" },
    });

    expect(await screen.findByRole("dialog", { name: "Guarded" })).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));
    expect(screen.getByRole("dialog", { name: "Guarded" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("dialog").getAttribute("data-dismissing")).toBe(
        "false",
      ),
    );

    fireEvent.click(screen.getByText("Allow"));
    fireEvent.click(screen.getByText("Close"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Guarded" })).toBeNull(),
    );
  });

  it("async blocker (confirm flow) keeps layer open until confirm resolves", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...dirtyFormOptions,
      payload: { title: "Edit", dirty: true },
    });

    expect(await screen.findByRole("dialog", { name: "Edit" })).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));

    expect(await screen.findByRole("dialog", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy();

    fireEvent.click(screen.getByText("No"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Confirm" })).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));
    expect(await screen.findByRole("dialog", { name: "Confirm" })).toBeTruthy();

    fireEvent.click(screen.getByText("Yes"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull(),
    );
  });

  it("dismissing is true while async blocker is pending, false after veto", async () => {
    const client = new LayerClient();

    function AsyncGuarded({
      call,
      payload,
      dismissing,
    }: LayerComponentProps<{ title: string }, boolean>) {
      const [gate] = useState(() => deferred<boolean>());
      useEffect(() => {
        const dispose = call.addBlocker(() => gate.promise);
        return dispose;
      }, [call, gate]);

      return (
        <div
          role="dialog"
          aria-label={payload.title}
          data-dismissing={String(dismissing)}
        >
          <button type="button" onClick={() => call.end(true)}>
            Close
          </button>
          <button
            type="button"
            onClick={() => gate.resolve(false)}
            data-testid="veto"
          >
            Veto
          </button>
        </div>
      );
    }

    const asyncOptions = layerOptions<{ title: string }, boolean>({
      stack: "main",
      key: ["main", "async-guard"],
      component: AsyncGuarded,
      exitingDelay: 0,
    });

    render(
      <StackProvider client={client}>
        <StackOutlet stack="main" />
      </StackProvider>,
    );

    void client.open({ ...asyncOptions, payload: { title: "Async" } });
    const dialog = await screen.findByRole("dialog", { name: "Async" });
    expect(dialog.getAttribute("data-dismissing")).toBe("false");

    fireEvent.click(screen.getByText("Close"));

    await waitFor(() =>
      expect(screen.getByRole("dialog").getAttribute("data-dismissing")).toBe(
        "true",
      ),
    );

    fireEvent.click(screen.getByTestId("veto"));

    await waitFor(() =>
      expect(screen.getByRole("dialog").getAttribute("data-dismissing")).toBe(
        "false",
      ),
    );
    expect(screen.getByRole("dialog", { name: "Async" })).toBeTruthy();
  });

  it("{ force: true } bypasses a vetoing blocker", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...guardedOptions,
      payload: { title: "Guarded" },
    });

    expect(await screen.findByRole("dialog", { name: "Guarded" })).toBeTruthy();

    fireEvent.click(screen.getByText("Force close"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Guarded" })).toBeNull(),
    );
  });

  it("dismissAll skipBlocked leaves blocked layer; force closes it", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({ ...openOptions, payload: { label: "Open" } });
    void client.open({ ...blockedOptions, payload: { label: "Blocked" } });

    expect(await screen.findByRole("dialog", { name: "Open" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Blocked" })).toBeTruthy();

    await client
      .getStack("main")
      .dismissAll(undefined, { mode: "skipBlocked" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Open" })).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "Blocked" })).toBeTruthy();

    await client.getStack("main").dismissAll(undefined, { mode: "force" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Blocked" })).toBeNull(),
    );
  });
});
