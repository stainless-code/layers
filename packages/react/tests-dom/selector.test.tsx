import type { LayerComponentProps, LayerState } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { StackProvider, useStack } from "@stainless-code/react-layers";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

function Panel({
  call: _call,
  payload,
}: LayerComponentProps<{ label: string }, void>) {
  return (
    <div role="region" aria-label={payload.label}>
      {payload.label}
    </div>
  );
}

const panelOptions = layerOptions<{ label: string }, void>({
  stack: "s",
  key: ["panel", "main"],
  component: Panel,
  exitingDelay: 0,
});

const otherOptions = layerOptions<{ label: string }, void>({
  stack: "other",
  key: ["panel", "other"],
  component: Panel,
  exitingDelay: 0,
});

function activeIdsEqual(a: LayerState[], b: LayerState[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.id === b[i]?.id);
}

function ActiveList() {
  const active = useStack(
    "s",
    (states) => states.filter((l) => l.phase === "active"),
    activeIdsEqual,
  );
  return (
    <ul data-testid="active-list">
      {active.map((s) => (
        <li key={s.id}>{String((s.payload as { label: string }).label)}</li>
      ))}
    </ul>
  );
}

let renderCount = 0;

function ActiveListWithCounter() {
  renderCount += 1;
  return <ActiveList />;
}

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <ActiveListWithCounter />
    </StackProvider>
  );
}

describe("React adapter — useStack selector memoization", () => {
  it("does not warn about uncached getSnapshot for object selectors", async () => {
    const client = new LayerClient();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App client={client} />);

    // Fire-and-render: the response promise only settles when the layer ends.
    void client.open({ ...panelOptions, payload: { label: "Main" } });

    expect(await screen.findByText("Main")).toBeTruthy();

    const getSnapshotWarnings = errorSpy.mock.calls.filter((args) =>
      String(args[0]).match(/getSnapshot/),
    );
    expect(getSnapshotWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("does not re-render when the selected slice is unchanged", async () => {
    const client = new LayerClient();
    renderCount = 0;

    render(<App client={client} />);

    void client.open({ ...panelOptions, payload: { label: "Main" } });
    expect(await screen.findByText("Main")).toBeTruthy();
    const afterOpen = renderCount;

    const stack = client.getStack("s");
    const state = stack.getSnapshot()[0];
    expect(state).toBeTruthy();
    const layer = stack.getLayer(state!.id);
    // A no-op status toggle keeps the active-id slice equal → no re-render.
    stack.setRunning(layer!, true);
    stack.setRunning(layer!, false);
    // Opening on a different stack must not notify the "s" consumer.
    void client.open({ ...otherOptions, payload: { label: "Other" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderCount).toBe(afterOpen);
  });
});
