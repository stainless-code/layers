import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient } from "@stainless-code/layers";
import { createStackHook } from "@stainless-code/preact-layers";
import type { AppLayerProps } from "@stainless-code/preact-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

function ModalDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-label={payload.title}>
      <h2>{payload.title}</h2>
      <button type="button" onClick={() => call.end(true)}>
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

describe("Preact adapter — createStackHook", () => {
  it("useAppStack.open binds the stack", async () => {
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

    render(
      <StackProvider client={client}>
        <AppHost />
        <Trigger />
      </StackProvider>,
    );

    fireEvent.click(screen.getByText("Open"));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(client.getStack("modal").getSnapshot()).toHaveLength(1);
    expect(pending).toBeDefined();

    fireEvent.click(screen.getByText("Confirm"));

    await expect(pending!).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });

  it("AppHost applies Host chrome", () => {
    const client = new LayerClient();
    const { StackProvider, AppHost } = createStackHook({
      stack: "modal",
      Host: ({ children }) => <div data-testid="chrome">{children}</div>,
    });

    render(
      <StackProvider client={client}>
        <AppHost />
      </StackProvider>,
    );

    expect(screen.getByTestId("chrome")).toBeTruthy();
  });

  it("AppLayer controlled open/close", async () => {
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
      const [open, setOpen] = useState(false);
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
            open={open}
            payload={{ title: "Controlled" }}
            onResolved={onResolved}
          />
        </>
      );
    }

    render(
      <StackProvider client={client}>
        <AppHost />
        <ControlledLayer />
      </StackProvider>,
    );

    fireEvent.click(screen.getByText("Show"));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Controlled")).toBeTruthy();

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
      const [open, setOpen] = useState(false);
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
            open={open}
            payload={{ title: "Dismiss me" }}
          />
        </>
      );
    }

    render(
      <StackProvider client={client}>
        <AppHost />
        <ControlledLayer />
      </StackProvider>,
    );

    fireEvent.click(screen.getByText("Show"));
    expect(await screen.findByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByText("Hide"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });
});
