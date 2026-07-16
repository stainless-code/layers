import { describe, expect, it } from "bun:test";

import { createLayer } from "./createLayer";
import { LayerClient } from "./layerClient";
import { layerOptions } from "./layerOptions";
import { LayerStack } from "./layerStack";
import type { StandardSchemaV1 } from "./standardSchema";
import { validatePayload } from "./validators";

describe("createLayer — control surface", () => {
  it("open binds current; current is null after dismiss", async () => {
    const client = new LayerClient();
    const confirm = layerOptions<{ title: string }, boolean>({
      key: ["confirm", "remove"],
    });
    const handle = createLayer(confirm, client);

    expect(handle.current).toBeNull();
    const pending = handle.open({ title: "Remove?" });
    expect(handle.current).not.toBeNull();
    expect(handle.current?.state.payload.title).toBe("Remove?");

    await handle.dismiss(true);
    expect(await pending).toBe(true);
    expect(handle.current).toBeNull();
  });

  it("dismiss targets topmost same-key layer by default", async () => {
    const client = new LayerClient();
    const opts = layerOptions<{ n: number }, boolean>({ key: ["dup"] });
    const handle = createLayer(opts, client);
    const stack = handle.stack;

    void handle.open({ n: 1 });
    const secondPending = handle.open({ n: 2 });
    const second = stack.find(["dup"])!;
    expect(second.state.payload.n).toBe(2);

    await handle.dismiss(false);
    expect(await secondPending).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(1);
  });

  it("dismiss by id targets the exact instance", async () => {
    const client = new LayerClient();
    const opts = layerOptions<{ n: number }, boolean>({ key: ["dup"] });
    const handle = createLayer(opts, client);

    const firstPending = handle.open({ n: 1 });
    void handle.open({ n: 2 });
    const first = handle.stack.getSnapshot()[0]!;
    const firstId = first.id;

    await handle.dismiss(true, { id: firstId });
    expect(await firstPending).toBe(true);
    expect(handle.stack.getSnapshot()).toHaveLength(1);
    expect(handle.stack.getSnapshot()[0]?.payload.n).toBe(2);
  });

  it("update patches the topmost layer by default", () => {
    const client = new LayerClient();
    const opts = layerOptions<{ msg: string }, void>({ key: ["toast"] });
    const handle = createLayer(opts, client);

    void handle.open({ msg: "a" });
    void handle.open({ msg: "b" });
    handle.update({ msg: "c" });
    expect(handle.stack.find(["toast"])?.state.payload.msg).toBe("c");
  });

  it("update by id patches the exact instance", () => {
    const client = new LayerClient();
    const opts = layerOptions<{ msg: string }, void>({ key: ["toast"] });
    const handle = createLayer(opts, client);

    void handle.open({ msg: "a" });
    void handle.open({ msg: "b" });
    const firstId = handle.stack.getSnapshot()[0]!.id;
    handle.update({ msg: "x" }, { id: firstId });
    expect(handle.stack.getSnapshot()[0]?.payload.msg).toBe("x");
    expect(handle.stack.getSnapshot()[1]?.payload.msg).toBe("b");
  });

  it("upsert merges into the topmost same-key layer", () => {
    const client = new LayerClient();
    const opts = layerOptions<{ msg: string }, void>({ key: ["toast"] });
    const handle = createLayer(opts, client);

    void handle.open({ msg: "a" });
    void handle.open({ msg: "b" });
    void handle.upsert({ msg: "c" });
    const snap = handle.stack.getSnapshot();
    expect(snap).toHaveLength(2);
    expect(handle.stack.find(["toast"])?.state.payload.msg).toBe("c");
    expect(snap[0]?.payload.msg).toBe("a");
  });

  it("no-op dismiss returns false when no target", async () => {
    const client = new LayerClient();
    const handle = createLayer(
      layerOptions<{ title: string }, boolean>({ key: ["confirm"] }),
      client,
    );
    expect(await handle.dismiss(true)).toBe(false);
  });

  it("void payload layers accept open() with no args", async () => {
    const client = new LayerClient();
    const handle = createLayer(
      layerOptions<void, boolean>({ key: ["void"] }),
      client,
    );
    const pending = handle.open();
    await handle.dismiss(true);
    expect(await pending).toBe(true);
  });
});

describe("createLayer — cancelQueued", () => {
  it("cancelQueued resolves a queued layer without mounting it", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const optsA = layerOptions<{ n: number }, boolean>({
      key: ["a"],
      stack: "default",
    });
    const optsB = layerOptions<{ n: number }, boolean>({
      key: ["b"],
      stack: "default",
    });
    const handleA = createLayer(optsA, client);
    const handleB = createLayer(optsB, client);

    void handleA.open({ n: 1 });
    const pending = handleB.open({ n: 2 });
    expect(handleB.stack.getQueuedSnapshot()).toHaveLength(1);

    expect(handleB.cancelQueued(false)).toBe(true);
    expect(await pending).toBe(false);
    expect(handleB.stack.getQueuedSnapshot()).toHaveLength(0);
    expect(handleB.stack.getSnapshot()).toHaveLength(1);

    await handleA.dismiss(true);
  });

  it("cancelQueued by id resolves exact queued instance", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const optsA = layerOptions<{ n: number }, boolean>({
      key: ["a"],
      stack: "default",
    });
    const optsK = layerOptions<{ n: number }, boolean>({
      key: ["k"],
      stack: "default",
    });
    const handleA = createLayer(optsA, client);
    const handleK = createLayer(optsK, client);

    void handleA.open({ n: 1 });
    void handleK.open({ n: 2 });
    const pendingC = handleK.open({ n: 3 });
    const cId = handleK.stack.getQueuedSnapshot()[1]?.id;
    expect(handleK.cancelQueued(false, { id: cId })).toBe(true);
    expect(await pendingC).toBe(false);
    expect(handleK.stack.getQueuedSnapshot()).toHaveLength(1);

    await handleA.dismiss(true);
  });

  it("cancelQueued by id returns false for mounted layer", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const handle = createLayer(
      layerOptions<{ n: number }, boolean>({
        key: ["a"],
        stack: "default",
      }),
      client,
    );
    void handle.open({ n: 1 });
    expect(handle.cancelQueued(false, { id: handle.current!.id })).toBe(false);
  });

  it("cancelQueued without id cancels FIFO head", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const optsA = layerOptions<{ n: number }, boolean>({
      key: ["a"],
      stack: "default",
    });
    const optsK = layerOptions<{ n: number }, boolean>({
      key: ["k"],
      stack: "default",
    });
    const handleA = createLayer(optsA, client);
    const handleK = createLayer(optsK, client);

    void handleA.open({ n: 1 });
    const pendingB = handleK.open({ n: 2 });
    void handleK.open({ n: 3 });
    expect(handleK.cancelQueued(false)).toBe(true);
    expect(await pendingB).toBe(false);
    expect(handleK.stack.getQueuedSnapshot()).toHaveLength(1);

    await handleA.dismiss(true);
  });

  it("cancelQueued by id returns false for other-key queued id", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const handleA = createLayer(
      layerOptions<{ n: number }, boolean>({
        key: ["a"],
        stack: "default",
      }),
      client,
    );
    const handleB = createLayer(
      layerOptions<{ n: number }, boolean>({
        key: ["b"],
        stack: "default",
      }),
      client,
    );
    void handleA.open({ n: 1 });
    void handleB.open({ n: 2 });
    const bId = handleB.stack.getQueuedSnapshot()[0]?.id;
    expect(handleA.cancelQueued(false, { id: bId })).toBe(false);
    expect(handleB.stack.getQueuedSnapshot()).toHaveLength(1);
  });
});

describe("createLayer — validated open", () => {
  it("open runs validate at runtime via stack.open", async () => {
    const idSchema = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v: unknown) => ({
          value: { id: Number((v as { id: string }).id) },
        }),
        types: undefined as unknown as {
          input: { id: string };
          output: { id: number };
        },
      },
    } as StandardSchemaV1<{ id: string }, { id: number }>;

    const client = new LayerClient();
    const handle = createLayer(
      {
        key: ["v"],
        validate: idSchema,
      },
      client,
    );

    void handle.open({ id: "42" });
    expect(handle.current?.state.payload).toEqual({ id: 42 });
    expect(validatePayload(idSchema, { id: "1" })).toEqual({ id: 1 });
    await handle.dismiss(undefined as void);
  });
});

describe("createLayer — escapes", () => {
  it("exposes client, stack, and options", () => {
    const client = new LayerClient();
    const opts = layerOptions<{ title: string }, boolean>({
      key: ["confirm"],
      stack: "modal",
    });
    const handle = createLayer(opts, client);

    expect(handle.client).toBe(client);
    expect(handle.stack).toBe(
      client.getStack("modal") as unknown as LayerStack<
        { title: string },
        boolean
      >,
    );
    expect(handle.options.key).toBe(opts.key);
  });
});
