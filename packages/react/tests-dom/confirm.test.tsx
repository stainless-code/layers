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
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

/** Minimal confirm dialog component — the canonical layer use case. */
function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <div role="dialog" aria-label={payload.title}>
      <h2>{payload.title}</h2>
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

const confirmOptions = layerOptions<
  { title: string; message: string },
  boolean
>({
  stack: "confirm",
  key: ["confirm", "remove-export"],
  component: ConfirmDialog,
  exitingDelay: 0,
});

/** A surface that mounts the confirm stack outlet. */
function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

describe("React adapter — confirm flow", () => {
  it("renders on open and resolves `true` when Yes is clicked", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export", message: "Are you sure?" },
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Are you sure?")).toBeTruthy();

    fireEvent.click(screen.getByText("Yes"));

    await expect(pending).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("resolves `false` when No is clicked", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export", message: "Are you sure?" },
    });

    fireEvent.click(await screen.findByText("No"));
    await expect(pending).resolves.toBe(false);
  });

  it("throws when used outside a StackProvider", () => {
    // Silence the expected error noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<StackOutlet stack="confirm" />)).toThrow(
      "[layers/react] No <StackProvider> found!",
    );
    spy.mockRestore();
  });

  it("useLayerClient returns the provided client", () => {
    const client = new LayerClient();
    function Probe() {
      const c = useLayerClient();
      return <span data-testid="same">{c === client ? "yes" : "no"}</span>;
    }
    render(
      <StackProvider client={client}>
        <Probe />
      </StackProvider>,
    );
    expect(screen.getByTestId("same").textContent).toBe("yes");
  });
});
