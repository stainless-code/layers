import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import {
  StackOutlet,
  StackProvider,
  useLayerGroup,
} from "@stainless-code/preact-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

const childPending = { current: null as Promise<string> | null };

function ChildDialog({
  call,
  payload,
}: LayerComponentProps<{ label: string }, string>) {
  return (
    <div role="dialog" aria-label={payload.label}>
      <p>{payload.label}</p>
      <button type="button" onClick={() => call.end("done")}>
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

function ParentDrawer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call);
  return (
    <div role="dialog" aria-label={payload.title}>
      <h2>{payload.title}</h2>
      <button
        type="button"
        onClick={() => {
          childPending.current = group.open({
            ...childOptions,
            payload: { label: "Child" },
          });
        }}
      >
        Open child
      </button>
      <group.Outlet />
      <button type="button" onClick={() => call.end(false)}>
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

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="drawer" />
    </StackProvider>
  );
}

describe("Preact adapter — useLayerGroup", () => {
  it("opens a nested layer through group.Outlet", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    expect(await screen.findByRole("dialog", { name: "Parent" })).toBeTruthy();

    fireEvent.click(screen.getByText("Open child"));

    expect(await screen.findByRole("dialog", { name: "Child" })).toBeTruthy();
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("auto-drains the child stack when the parent is dismissed", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    fireEvent.click(await screen.findByText("Open child"));
    expect(await screen.findByRole("dialog", { name: "Child" })).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Parent" })).toBeNull(),
    );
  });

  it("resolves group.open when the child layer ends", async () => {
    const client = new LayerClient();
    childPending.current = null;
    render(<App client={client} />);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    fireEvent.click(await screen.findByText("Open child"));
    fireEvent.click(await screen.findByText("Done"));

    await expect(childPending.current).resolves.toBe("done");
  });
});
