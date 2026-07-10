import { cleanup, render, screen } from "@solidjs/testing-library";
import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createStackHook,
  LayerClientContext,
  StackOutlet,
  useLayerGroup,
  useMutationFlow,
} from "../src/index";
import type { AppLayerProps } from "../src/index";

afterEach(() => {
  cleanup();
});

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let saveDeferred: ReturnType<typeof createDeferred> | null = null;

function SaveDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  const flow = useMutationFlow(props.call);

  return (
    <div role="dialog" aria-label={props.payload.title}>
      <span data-testid="pending">{String(flow.pending())}</span>
      <span data-testid="status">{props.actionStatus}</span>
      <button
        type="button"
        onClick={() =>
          void flow
            .run(async () => {
              await saveDeferred!.promise;
            })
            .orEnd(true)
        }
      >
        Save
      </button>
    </div>
  );
}

const saveOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["save", "export"],
  component: SaveDialog,
  exitingDelay: 0,
});

function MutationApp(props: { client: LayerClient }) {
  return (
    <LayerClientContext.Provider value={props.client}>
      <StackOutlet stack="confirm" />
    </LayerClientContext.Provider>
  );
}

describe("Solid adapter — useMutationFlow", () => {
  it("reflects pending idle→running in the DOM, then ends on success", async () => {
    const client = new LayerClient();
    saveDeferred = createDeferred();
    render(() => <MutationApp client={client} />);

    const pending = client.open({
      ...saveOptions,
      payload: { title: "Save export" },
    });

    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("pending").textContent).toBe("false");
    expect(screen.getByTestId("status").textContent).toBe("idle");

    screen.getByText("Save").click();
    await Promise.resolve();

    expect(screen.getByTestId("pending").textContent).toBe("true");
    expect(screen.getByTestId("status").textContent).toBe("running");

    saveDeferred.resolve();
    await Promise.resolve();

    await expect(pending).resolves.toBe(true);
    await Promise.resolve();

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function ChildDialog(props: LayerComponentProps<{ label: string }, string>) {
  return (
    <div role="dialog" aria-label={props.payload.label}>
      <p>{props.payload.label}</p>
      <button type="button" onClick={() => props.call.end("done")}>
        Done
      </button>
    </div>
  );
}

const childOptions = layerOptions<{ label: string }, string>({
  key: ["drawer", "child"],
  component: ChildDialog,
  exitingDelay: 0,
});

function ParentDrawer(props: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(props.call);

  return (
    <div role="dialog" aria-label={props.payload.title}>
      <h2>{props.payload.title}</h2>
      <button
        type="button"
        onClick={() => {
          void group.open({
            ...childOptions,
            payload: { label: "Child" },
          });
        }}
      >
        Open child
      </button>
      <group.Outlet />
      <button type="button" onClick={() => props.call.end(false)}>
        Close
      </button>
    </div>
  );
}

const parentOptions = layerOptions<{ title: string }, boolean>({
  stack: "drawer",
  key: ["drawer", "parent"],
  component: ParentDrawer,
  exitingDelay: 0,
});

function DrawerApp(props: { client: LayerClient }) {
  return (
    <LayerClientContext.Provider value={props.client}>
      <StackOutlet stack="drawer" />
    </LayerClientContext.Provider>
  );
}

describe("Solid adapter — useLayerGroup", () => {
  it("opens a nested layer through group.Outlet", async () => {
    const client = new LayerClient();
    render(() => <DrawerApp client={client} />);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await Promise.resolve();

    expect(screen.getByRole("dialog", { name: "Parent" })).toBeTruthy();

    screen.getByText("Open child").click();
    await Promise.resolve();

    expect(screen.getByRole("dialog", { name: "Child" })).toBeTruthy();
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("auto-drains the child stack when the parent unmounts", async () => {
    const client = new LayerClient();
    render(() => <DrawerApp client={client} />);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await Promise.resolve();

    screen.getByText("Open child").click();
    await Promise.resolve();

    expect(screen.getByRole("dialog", { name: "Child" })).toBeTruthy();

    screen.getByText("Close").click();
    await Promise.resolve();

    expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Parent" })).toBeNull();
  });
});

function ModalDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-label={props.payload.title}>
      <h2>{props.payload.title}</h2>
      <button type="button" onClick={() => props.call.end(true)}>
        Confirm
      </button>
    </div>
  );
}

const modalLayerOpts = {
  key: ["modal", "settings"],
  component: ModalDialog,
  exitingDelay: 0,
};

describe("Solid adapter — createStackHook", () => {
  it("StackProvider + AppHost render a layer opened via useAppStack().open", async () => {
    const client = new LayerClient();
    const { StackProvider, useAppStack, AppHost } = createStackHook({
      stack: "modal",
    });
    let pending: Promise<boolean> | undefined;

    function Trigger() {
      const { open } = useAppStack();
      return (
        <button
          type="button"
          onClick={() => {
            pending = open({
              ...modalLayerOpts,
              payload: { title: "Settings" },
            });
          }}
        >
          Open
        </button>
      );
    }

    render(() => (
      <StackProvider client={client}>
        <AppHost />
        <Trigger />
      </StackProvider>
    ));

    screen.getByText("Open").click();
    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(client.getStack("modal").getSnapshot()).toHaveLength(1);
    expect(pending).toBeDefined();

    screen.getByText("Confirm").click();
    await Promise.resolve();

    await expect(pending!).resolves.toBe(true);
    await Promise.resolve();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });

  it("AppLayer controlled open renders and dismisses when open is false", async () => {
    const client = new LayerClient();
    const onResolved = vi.fn();
    const { StackProvider, AppHost, AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "settings"],
      component: ModalDialog,
      exitingDelay: 0,
    } satisfies Omit<
      AppLayerProps<{ title: string }, boolean>["options"],
      never
    >;

    function ControlledLayer() {
      const [open, setOpen] = createSignal(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Hide
          </button>
          <AppLayer
            options={layerOpts}
            open={open()}
            payload={{ title: "Controlled" }}
            onResolved={onResolved}
          />
        </>
      );
    }

    render(() => (
      <StackProvider client={client}>
        <AppHost />
        <ControlledLayer />
      </StackProvider>
    ));

    screen.getByText("Show").click();
    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Controlled")).toBeTruthy();

    screen.getByText("Confirm").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onResolved).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AppLayer dismisses when open flips true to false", async () => {
    const client = new LayerClient();
    const { StackProvider, AppHost, AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "dismiss-test"],
      component: ModalDialog,
      exitingDelay: 0,
    };

    function ControlledLayer() {
      const [open, setOpen] = createSignal(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Show
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Hide
          </button>
          <AppLayer
            options={layerOpts}
            open={open()}
            payload={{ title: "Dismiss me" }}
          />
        </>
      );
    }

    render(() => (
      <StackProvider client={client}>
        <AppHost />
        <ControlledLayer />
      </StackProvider>
    ));

    screen.getByText("Show").click();
    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();

    screen.getByText("Hide").click();
    await Promise.resolve();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });
});
