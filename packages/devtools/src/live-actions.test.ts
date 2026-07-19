import { describe, expect, it } from "bun:test";

import { LayerClient } from "@stainless-code/layers";

import {
  cancelQueuedHead,
  dismissAllWithMode,
  forceClearStack,
  forceDismissTop,
  softDismissTop,
} from "./live-actions";

describe("live-actions", () => {
  it("softDismissTop dismisses the top layer without force", async () => {
    const client = new LayerClient();
    const openPromise = client.open({
      key: ["soft"],
      payload: { n: 1 },
    });
    await Promise.resolve();

    const result = softDismissTop(client, "default");
    expect(result).not.toBe(false);
    await result;
    await openPromise;

    expect(client.getStack("default").getSnapshot()).toHaveLength(0);
  });

  it("softDismissTop returns false when the stack is empty", () => {
    const client = new LayerClient();
    client.ensureStack("default");
    expect(softDismissTop(client, "default")).toBe(false);
  });

  it("cancelQueuedHead cancels the FIFO queued layer", async () => {
    const client = new LayerClient();
    client.ensureStack("default", { scope: { strategy: "serial" } });

    const a = client.open({ key: ["a"], payload: {} });
    const b = client.open({ key: ["b"], payload: {} });
    await Promise.resolve();

    expect(client.getStack("default").getQueuedSnapshot()).toHaveLength(1);
    expect(cancelQueuedHead(client, "default")).toBe(true);
    expect(await b).toBeUndefined();
    expect(client.getStack("default").getQueuedSnapshot()).toHaveLength(0);

    expect(forceDismissTop(client, "default")).not.toBe(false);
    await a;
  });

  it("forceDismissTop bypasses blockers", async () => {
    const client = new LayerClient();
    const openPromise = client.open({
      key: ["blocked"],
      payload: {},
    });
    await Promise.resolve();

    const stack = client.getStack("default");
    const layer = stack.getSnapshot()[0];
    expect(layer).toBeDefined();
    stack.getLayer(layer!.id)!.addBlocker(() => false);

    const soft = softDismissTop(client, "default");
    expect(soft).not.toBe(false);
    expect(await soft).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);

    const forced = forceDismissTop(client, "default");
    expect(forced).not.toBe(false);
    expect(await forced).toBe(true);
    await openPromise;
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("dismissAllWithMode completes open callers with undefined", async () => {
    const client = new LayerClient();
    client.ensureStack("default", { scope: { strategy: "serial" } });

    const a = client.open({ key: ["a"], payload: {} });
    const b = client.open({ key: ["b"], payload: {} });
    await Promise.resolve();

    await dismissAllWithMode(client, "default", "force");
    expect(await a).toBeUndefined();
    expect(await b).toBeUndefined();

    const stack = client.getStack("default");
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);
  });

  it("forceClearStack rejects open callers with LayerCancelledError", async () => {
    const client = new LayerClient();
    client.ensureStack("default", { scope: { strategy: "serial" } });

    const a = client.open({ key: ["a"], payload: {} });
    const b = client.open({ key: ["b"], payload: {} });
    await Promise.resolve();

    await forceClearStack(client, "default");
    await expect(a).rejects.toMatchObject({
      name: "LayerCancelledError",
      reason: "cancelAll",
    });
    await expect(b).rejects.toMatchObject({
      name: "LayerCancelledError",
      reason: "cancelAll",
    });

    const stack = client.getStack("default");
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);
  });

  it("dismissAllWithMode skipBlocked leaves a blocked layer", async () => {
    const client = new LayerClient();
    const openPromise = client.open({ key: ["blocked"], payload: {} });
    await Promise.resolve();

    const stack = client.getStack("default");
    const layer = stack.getSnapshot()[0];
    expect(layer).toBeDefined();
    stack.getLayer(layer!.id)!.addBlocker(() => false);

    await dismissAllWithMode(client, "default", "skipBlocked");
    expect(stack.getSnapshot()).toHaveLength(1);

    expect(forceDismissTop(client, "default")).not.toBe(false);
    await openPromise;
  });

  it("missing stackId does not materialize a stack", async () => {
    const client = new LayerClient();
    expect(client.getStackIds()).toEqual([]);

    expect(softDismissTop(client, "missing")).toBe(false);
    expect(cancelQueuedHead(client, "missing")).toBe(false);
    expect(forceDismissTop(client, "missing")).toBe(false);
    await dismissAllWithMode(client, "missing", "force");
    await forceClearStack(client, "missing");

    expect(client.getStackIds()).toEqual([]);
  });
});
