import { describe, expect, it, spyOn } from "bun:test";

import type { StackNotifyEvent } from "@stainless-code/layers";
import { LayerClient } from "@stainless-code/layers";

import { attachLayerDevtools } from "./attach";
import { layersEventClient } from "./event-client";

describe("attachLayerDevtools", () => {
  it("emits stack-registry on attach and stack-state on notify", async () => {
    const emit = spyOn(layersEventClient, "emit");

    const client = new LayerClient();
    const detach = attachLayerDevtools(client);

    expect(emit).toHaveBeenCalledWith("stack-registry", { stackIds: [] });

    const key = ["devtools-test"] as const;
    void client.open({ key, payload: { hello: "world" } });

    await Promise.resolve();

    const stateCalls = emit.mock.calls.filter(
      (call) => call[0] === "stack-state",
    );
    expect(stateCalls.length).toBeGreaterThan(0);
    const lastState = stateCalls.at(-1)?.[1] as StackNotifyEvent | undefined;
    expect(lastState?.stackId).toBe("default");
    expect(lastState?.active.length).toBeGreaterThan(0);

    emit.mockClear();
    detach();

    void client.open({ key, payload: { after: "detach" } });
    await Promise.resolve();

    const afterDetach = emit.mock.calls.filter(
      (call) => call[0] === "stack-state",
    );
    expect(afterDetach.length).toBe(0);

    emit.mockRestore();
  });

  it("refreshes stack-registry when a new stack materializes", () => {
    const emit = spyOn(layersEventClient, "emit");
    const client = new LayerClient();
    const detach = attachLayerDevtools(client);

    emit.mockClear();
    client.ensureStack("secondary");

    const registryCalls = emit.mock.calls.filter(
      (call) => call[0] === "stack-registry",
    );
    expect(registryCalls.at(-1)?.[1]).toEqual({
      stackIds: ["secondary"],
    });

    detach();
    emit.mockRestore();
  });

  it("seeds stack-state for stacks that already have layers", async () => {
    const client = new LayerClient();
    void client.open({ key: ["pre-attach"], payload: { ready: true } });
    await Promise.resolve();

    const emit = spyOn(layersEventClient, "emit");
    const detach = attachLayerDevtools(client);

    const stateCalls = emit.mock.calls.filter(
      (call) => call[0] === "stack-state",
    );
    expect(stateCalls.length).toBeGreaterThan(0);
    const seeded = stateCalls[0]?.[1] as StackNotifyEvent | undefined;
    expect(seeded?.stackId).toBe("default");
    expect(seeded?.action).toBe("register");
    expect(seeded?.active.length).toBeGreaterThan(0);

    detach();
    emit.mockRestore();
  });

  it("registers the live client for panel actions and clears on detach", async () => {
    const { getAttachedLayerClient } = await import("./live-client");
    const client = new LayerClient();
    expect(getAttachedLayerClient()).toBeNull();

    const detach = attachLayerDevtools(client);
    expect(getAttachedLayerClient()).toBe(client);

    detach();
    expect(getAttachedLayerClient()).toBeNull();
  });

  it("re-attach without detach does not double-subscribe", async () => {
    const emit = spyOn(layersEventClient, "emit");
    const client = new LayerClient();
    attachLayerDevtools(client);
    attachLayerDevtools(client);

    emit.mockClear();
    void client.open({ key: ["once"], payload: 1 });
    await Promise.resolve();

    const stateCalls = emit.mock.calls.filter(
      (call) => call[0] === "stack-state",
    );
    // register + open once each (not doubled)
    expect(stateCalls).toHaveLength(2);

    emit.mockRestore();
  });

  it("attach(B) detaches prior client A", async () => {
    const emit = spyOn(layersEventClient, "emit");
    const a = new LayerClient();
    const b = new LayerClient();
    attachLayerDevtools(a);
    attachLayerDevtools(b);

    emit.mockClear();
    void a.open({ key: ["from-a"], payload: 1 });
    await Promise.resolve();
    expect(
      emit.mock.calls.filter((call) => call[0] === "stack-state"),
    ).toHaveLength(0);

    void b.open({ key: ["from-b"], payload: 1 });
    await Promise.resolve();
    expect(
      emit.mock.calls.filter((call) => call[0] === "stack-state").length,
    ).toBeGreaterThan(0);

    emit.mockRestore();
  });
});
