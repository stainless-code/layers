import { describe, expect, it } from "bun:test";

import { LayerClient } from "./layerClient";
import { LayerStack } from "./layerStack";
import type { StackNotifyEvent } from "./types";

describe("LayerClient — loadFn", () => {
  it("forwards loadFn through open to the stack", async () => {
    const client = new LayerClient();
    client.open({
      key: ["d"],
      payload: { id: 1 },
      stack: "modal",
      loadFn: async () => "data",
    });
    const stack = client.getStack("modal") as unknown as LayerStack<
      { id: number },
      void,
      Error,
      string
    >;
    expect(stack.getSnapshot()[0]?.phase).toBe("pending");
    await Promise.resolve();
    await Promise.resolve();
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getSnapshot()[0]?.data).toBe("data");
  });
});

describe("LayerClient — stack enumeration", () => {
  it("getStackIds lists all materialized stacks", () => {
    const client = new LayerClient();
    client.open({ key: ["a"], payload: 1, stack: "modal" });
    client.open({ key: ["b"], payload: 2, stack: "toast" });
    const ids = client.getStackIds();
    expect(ids).toContain("modal");
    expect(ids).toContain("toast");
    expect(ids).toHaveLength(2);
  });
});

describe("LayerClient — subscribeNotify", () => {
  it("emits register then open after a successful open that mounts a layer", async () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });

    void client.open({ key: ["a"], payload: { n: 1 } });
    await Promise.resolve();

    expect(events.map((e) => e.action)).toEqual(["register", "open"]);
    expect(events[1]?.active).toHaveLength(1);
    expect(events[1]?.queued).toHaveLength(0);
    expect(events[1]?.stackId).toBe("default");
    expect(events[1]?.seq).toBeGreaterThan(events[0]?.seq ?? 0);
    expect(events[1]?.active[0]?.key).toBeTruthy();
    expect(events[1]?.active[0]?.payload).toEqual({ n: 1 });
  });

  it("does not emit when a mutation leaves snapshot refs unchanged", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    client.open({ key: ["a"], payload: { n: 1 } });
    const stack = client.getStack();
    const layer = stack.getLayer(stack.getSnapshot()[0]!.id)!;
    events.length = 0;
    stack.setRunning(layer, false);
    expect(events).toHaveLength(0);
  });

  it("works with zero listeners without throwing", () => {
    const client = new LayerClient();
    expect(() => {
      client.open({ key: ["a"], payload: 1 });
    }).not.toThrow();
  });

  it("unsubscribe stops notify delivery", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    const off = client.subscribeNotify((event) => {
      events.push(event);
    });
    off();
    client.open({ key: ["a"], payload: 1, stack: "other" });
    expect(events).toHaveLength(0);
  });

  it("emits dismiss after dismiss commits", async () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["a"], payload: { n: 1 } });
    await Promise.resolve();
    const stack = client.getStack();
    const layer = stack.getLayer(stack.getSnapshot()[0]!.id)!;
    events.length = 0;
    await stack.dismiss(layer);
    expect(events.some((e) => e.action === "dismiss")).toBe(true);
    expect(events.at(-1)?.active).toHaveLength(0);
  });

  it("emits dismissVetoed when a soft dismiss is blocked", async () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["a"], payload: { n: 1 } });
    await Promise.resolve();
    const stack = client.getStack();
    const layer = stack.getLayer(stack.getSnapshot()[0]!.id)!;
    layer.addBlocker(() => false);
    events.length = 0;
    expect(await stack.dismiss(layer)).toBe(false);
    expect(events.at(-1)?.action).toBe("dismissVetoed");
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getSnapshot()[0]?.dismissing).toBe(false);
    expect(events.at(-1)?.active[0]?.dismissing).toBe(false);
  });

  it("marks payloadTruncated when payload is not JSON-cloneable", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["big"], payload: { n: 1n } });
    const open = events.find((e) => e.action === "open");
    expect(open?.active[0]?.payloadTruncated).toBe(true);
    expect(open?.active[0]?.payload).toBeUndefined();
  });

  it("omits payload fields when open has no payload / undefined", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["no-payload"] });
    const open = events.find((e) => e.action === "open");
    expect(open?.active[0]?.payload).toBeUndefined();
    expect(open?.active[0]?.payloadTruncated).toBeUndefined();
  });

  it("marks payloadTruncated for non-finite number payloads", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["nan"], payload: Number.NaN });
    const open = events.find((e) => e.action === "open");
    expect(open?.active[0]?.payloadTruncated).toBe(true);
    expect(open?.active[0]?.payload).toBeUndefined();
  });

  it("isolates a throwing listener so open still materializes", async () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify(() => {
      throw new Error("bad listener");
    });
    client.subscribeNotify((event) => {
      events.push(event);
    });

    const promise = client.open({ key: ["a"], payload: 1 });
    expect(promise).toBeInstanceOf(Promise);
    await Promise.resolve();

    expect(client.getStack().getSnapshot()).toHaveLength(1);
    expect(events.map((e) => e.action)).toEqual(["register", "open"]);
  });

  it("emits update after stack.update", () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["a"], payload: { n: 1 } });
    const stack = client.getStack();
    const layer = stack.getLayer(stack.getSnapshot()[0]!.id)!;
    events.length = 0;
    stack.update(layer, { n: 2 });
    expect(events.map((e) => e.action)).toEqual(["update"]);
    expect(events[0]?.active[0]?.payload).toEqual({ n: 2 });
  });

  it("emits cancelQueued for a serial queued layer", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["a"], payload: { n: 1 } });
    void client.open({ key: ["b"], payload: { n: 2 } });
    expect(client.getStack().getQueuedSnapshot()).toHaveLength(1);
    events.length = 0;
    expect(client.getStack().cancelQueued(["b"], undefined)).toBe(true);
    expect(events.some((e) => e.action === "cancelQueued")).toBe(true);
    expect(events.at(-1)?.queued).toHaveLength(0);
  });

  it("emits dismissAll after dismissAll clears the stack", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["a"], payload: { n: 1 } });
    void client.open({ key: ["b"], payload: { n: 2 } });
    expect(client.getStack().getQueuedSnapshot()).toHaveLength(1);
    events.length = 0;
    await client.dismissAll();
    expect(events.some((e) => e.action === "dismissAll")).toBe(true);
    expect(events.at(-1)?.active).toHaveLength(0);
    expect(events.at(-1)?.queued).toHaveLength(0);
  });

  it("emits dismissAll when only active layers exist", async () => {
    const client = new LayerClient();
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    void client.open({ key: ["solo"], payload: { n: 1 } });
    await Promise.resolve();
    expect(client.getStack().getQueuedSnapshot()).toHaveLength(0);
    expect(client.getStack().getSnapshot()).toHaveLength(1);
    events.length = 0;
    await client.dismissAll();
    expect(events.some((e) => e.action === "dismissAll")).toBe(true);
    expect(events.at(-1)?.active).toHaveLength(0);
  });

  it("seedNotify re-emits register for existing stacks", () => {
    const client = new LayerClient();
    void client.open({ key: ["a"], payload: 1, stack: "modal" });
    const events: StackNotifyEvent[] = [];
    client.subscribeNotify((event) => {
      events.push(event);
    });
    client.seedNotify("modal");
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("register");
    expect(events[0]?.stackId).toBe("modal");
    expect(events[0]?.active).toHaveLength(1);

    events.length = 0;
    client.seedNotify();
    expect(
      events.some((e) => e.stackId === "modal" && e.action === "register"),
    ).toBe(true);
  });
});

describe("LayerClient — subscribeStacks", () => {
  it("notifies on first materialization only; unsubscribe stops calls", () => {
    const client = new LayerClient();
    const seen: string[] = [];
    const unsubscribe = client.subscribeStacks((stackId) => {
      seen.push(stackId);
    });

    client.open({ key: ["a"], payload: 1, stack: "new-stack" });
    expect(seen).toEqual(["new-stack"]);

    client.open({ key: ["b"], payload: 2, stack: "new-stack" });
    expect(seen).toEqual(["new-stack"]);

    unsubscribe();
    client.open({ key: ["c"], payload: 3, stack: "another-stack" });
    expect(seen).toEqual(["new-stack"]);
  });
});
