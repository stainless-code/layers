import { cleanup, render, screen } from "@solidjs/testing-library";
import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { onMount } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LayerClientContext, StackOutlet, StackSubscribe } from "../src/index";

afterEach(() => {
  cleanup();
});

function ConfirmDialog(
  props: LayerComponentProps<{ title: string; message: string }, boolean>,
) {
  return (
    <div role="dialog" aria-label={props.payload.title}>
      <h2>{props.payload.title}</h2>
      <p>{props.payload.message}</p>
      <button type="button" onClick={() => props.call.end(true)}>
        Yes
      </button>
      <button type="button" onClick={() => props.call.end(false)}>
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

const modalOptionsNoComponent = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "no-component"],
  exitingDelay: 0,
});

let mountCount = 0;

function StatusDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  onMount(() => {
    mountCount += 1;
  });
  return (
    <div role="dialog" aria-label={props.payload.title}>
      <span data-testid="status">{props.actionStatus}</span>
      <button type="button" onClick={() => props.call.setRunning(true)}>
        Run
      </button>
      <button type="button" onClick={() => props.call.end(true)}>
        Confirm
      </button>
    </div>
  );
}

const statusOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "status"],
  component: StatusDialog,
  exitingDelay: 0,
});

function OutletHost(props: { client: LayerClient; stack?: string }) {
  return (
    <LayerClientContext.Provider value={props.client}>
      <StackOutlet stack={props.stack ?? "confirm"} />
    </LayerClientContext.Provider>
  );
}

describe("Solid adapter — StackOutlet", () => {
  it("renders on open and removes on close", async () => {
    const client = new LayerClient();
    render(() => <OutletHost client={client} />);

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export", message: "Are you sure?" },
    });

    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Are you sure?")).toBeTruthy();

    screen.getByText("Yes").click();
    await expect(pending).resolves.toBe(true);
    await Promise.resolve();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not remount the layer component when state changes", async () => {
    mountCount = 0;
    const client = new LayerClient();
    render(() => <OutletHost client={client} />);

    void client.open({
      ...statusOptions,
      payload: { title: "Status modal" },
    });

    await Promise.resolve();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mountCount).toBe(1);
    expect(screen.getByTestId("status").textContent).toBe("idle");

    screen.getByText("Run").click();
    await Promise.resolve();

    expect(mountCount).toBe(1);
    expect(screen.getByTestId("status").textContent).toBe("running");
  });

  it("StackOutlet dev-warns on missing component", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LayerClient();
    render(() => <OutletHost client={client} stack="modal" />);

    void client.open({
      ...modalOptionsNoComponent,
      payload: { title: "No component" },
    });

    await Promise.resolve();

    const warnMessage = warnSpy.mock.calls.find(([msg]) =>
      String(msg).includes("[layers/solid]"),
    );
    expect(warnMessage).toBeTruthy();
    expect(String(warnMessage?.[0])).toContain("No component for layer");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    warnSpy.mockRestore();
  });
});

describe("Solid adapter — StackSubscribe", () => {
  it("renders the selected value and updates reactively", async () => {
    const client = new LayerClient();

    render(() => (
      <LayerClientContext.Provider value={client}>
        <StackSubscribe stack="s" selector={(states) => states.length}>
          {(value) => <span data-testid="count">{value()}</span>}
        </StackSubscribe>
      </LayerClientContext.Provider>
    ));

    await Promise.resolve();
    expect(screen.getByTestId("count").textContent).toBe("0");

    void client.open({ key: ["a"], payload: 1, stack: "s" });
    await Promise.resolve();

    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
