import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { StackOutlet, StackProvider } from "@stainless-code/react-layers";
import {
  act,
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

  it("enteringDelay: observable entering then settled", () => {
    // Fake timers keep the entering→settled window deterministic: with real
    // timers the 20ms `enteringDelay` can elapse before an async `findByRole`
    // resolves, so the first assertion races the auto-settle timer.
    vi.useFakeTimers();
    try {
      const client = new LayerClient();
      render(<App client={client} />);

      act(() => {
        void client.open({
          ...enteringOptions,
          payload: { label: "Entering" },
        });
      });

      // Timer not yet fired — the layer is mid-enter.
      expect(screen.getByRole("dialog").getAttribute("data-transition")).toBe(
        "entering",
      );

      // Fire the `enteringDelay` timer — it auto-settles.
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByRole("dialog").getAttribute("data-transition")).toBe(
        "settled",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
