import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { StackOutlet, StackProvider } from "@stainless-code/react-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

/** Renders `transition` on the DOM so enter/exit axes are observable. */
function TransitionProbe({
  call,
  payload,
  transition,
}: LayerComponentProps<{ label: string }, boolean>) {
  return (
    <div role="dialog" aria-label={payload.label} data-transition={transition}>
      <span>{payload.label}</span>
      <button type="button" onClick={() => call.end(true)}>
        End
      </button>
      <button type="button" onClick={() => call.settle()}>
        Settle
      </button>
    </div>
  );
}

const instantOptions = layerOptions<{ label: string }, boolean>({
  stack: "transition",
  key: ["transition", "instant"],
  component: TransitionProbe,
});

const exitingOptions = layerOptions<{ label: string }, boolean>({
  stack: "transition",
  key: ["transition", "exiting"],
  component: TransitionProbe,
  exitingDelay: 2000,
});

const enteringOptions = layerOptions<{ label: string }, boolean>({
  stack: "transition",
  key: ["transition", "entering"],
  component: TransitionProbe,
  enteringDelay: 20,
});

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="transition" />
    </StackProvider>
  );
}

describe("React adapter — transition lifecycle", () => {
  it("instant default: opens settled and removes on dismiss with no linger", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    const pending = client.open({
      ...instantOptions,
      payload: { label: "Instant" },
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-transition")).toBe("settled");

    fireEvent.click(screen.getByText("End"));
    await expect(pending).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("call.settle() on exit removes layer before exitingDelay cap", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...exitingOptions,
      payload: { label: "Exiting" },
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-transition")).toBe("settled");

    fireEvent.click(screen.getByText("End"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("dialog").getAttribute("data-transition")).toBe(
        "exiting",
      ),
    );

    fireEvent.click(screen.getByText("Settle"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.getStack("transition").getSnapshot()).toHaveLength(0);
  });

  it("enteringDelay: observable entering then settled", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    void client.open({
      ...enteringOptions,
      payload: { label: "Entering" },
    });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-transition")).toBe("entering");

    await waitFor(
      () =>
        expect(screen.getByRole("dialog").getAttribute("data-transition")).toBe(
          "settled",
        ),
      { timeout: 500 },
    );
  });
});
