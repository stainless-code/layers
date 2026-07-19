import { describe, expect, it } from "bun:test";

import {
  isLayerKeyError,
  isPayloadValidationError,
  LayerKeyError,
  PayloadValidationError,
} from "./errors";
import { LayerClient } from "./layerClient";
import { layerOptions } from "./layerOptions";
import { LayerStack } from "./layerStack";
import { notifyManager } from "./notifyManager";
import {
  assertLayerKey,
  hashKey,
  keySignature,
  shallowArrayEqual,
} from "./utils";

describe("hashKey / keySignature", () => {
  it("is stable across key-object key order", () => {
    expect(hashKey(["a", { b: 1, a: 2 }])).toBe(hashKey(["a", { a: 2, b: 1 }]));
  });
  it("distinguishes different keys", () => {
    expect(keySignature(["confirm", "x"])).not.toBe(
      keySignature(["confirm", "y"]),
    );
  });
  it("accepts JSON-safe primitives, arrays, and plain objects", () => {
    expect(() =>
      assertLayerKey(["modal", 1, true, null, { nested: ["a", 2] }]),
    ).not.toThrow();
    expect(hashKey([])).toBe("[]");
    expect(hashKey([["a"]])).toBe(JSON.stringify([["a"]]));
    expect(hashKey(["modal", 1, true, null])).toBe(
      JSON.stringify(["modal", 1, true, null]),
    );
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.id = 1;
    expect(hashKey([nullProto])).toBe(JSON.stringify([{ id: 1 }]));
  });
  it("accepts shared object refs (DAGs), not only trees", () => {
    const shared = { id: 1 };
    expect(hashKey([{ x: shared, y: shared }])).toBe(
      JSON.stringify([{ x: { id: 1 }, y: { id: 1 } }]),
    );
    expect(hashKey([shared, shared])).toBe(
      JSON.stringify([{ id: 1 }, { id: 1 }]),
    );
  });
  it("preserves own __proto__ keys in the hash (no prototype clobber)", () => {
    const withProto = JSON.parse('{"__proto__":{"a":1}}') as Record<
      string,
      unknown
    >;
    expect(hashKey([withProto])).not.toBe(hashKey([{}]));
    expect(hashKey([withProto])).toBe(JSON.stringify([withProto]));
  });
  it("rejects undefined, non-finite numbers, bigint, and non-plain objects", () => {
    const cases: Array<{ key: unknown; pathHint: string }> = [
      { key: [undefined], pathHint: "key[0]" },
      { key: [{ a: undefined }], pathHint: "key[0].a" },
      { key: [NaN], pathHint: "key[0]" },
      { key: [Infinity], pathHint: "key[0]" },
      { key: [-Infinity], pathHint: "key[0]" },
      { key: [1n], pathHint: "key[0]" },
      { key: [() => {}], pathHint: "key[0]" },
      { key: [new Date()], pathHint: "key[0]" },
      { key: [Symbol("x")], pathHint: "key[0]" },
    ];
    for (const { key, pathHint } of cases) {
      expect(() => hashKey(key as never)).toThrow(LayerKeyError);
      try {
        hashKey(key as never);
      } catch (error) {
        expect(isLayerKeyError(error)).toBe(true);
        if (isLayerKeyError(error)) {
          expect(error.message).toContain(pathHint);
        }
      }
    }
  });
  it("rejects cyclic structures", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => hashKey([cyclic])).toThrow(LayerKeyError);
  });
  it("null is accepted; undefined throws (no longer collide)", () => {
    expect(hashKey([null])).toBe(JSON.stringify([null]));
    expect(() => hashKey([undefined])).toThrow(LayerKeyError);
  });
});

describe("shallowArrayEqual", () => {
  it("treats equal element refs as equal even when the array is new", () => {
    const a = { id: 1 };
    const b = { id: 2 };
    expect(shallowArrayEqual([a, b], [a, b])).toBe(true);
    expect(shallowArrayEqual([a, b], [a, { id: 2 }])).toBe(false);
  });
});

describe("LayerStack — basics", () => {
  it("open/find/cancelQueued throw LayerKeyError synchronously for non-JSON-safe keys", () => {
    const stack = new LayerStack("s");
    expect(() =>
      stack.open({
        key: [undefined],
        payload: {},
      }),
    ).toThrow(LayerKeyError);
    expect(() => stack.find([undefined])).toThrow(LayerKeyError);
    expect(() => stack.cancelQueued([undefined], undefined)).toThrow(
      LayerKeyError,
    );
  });

  it("open pushes, indexes, and goes active without loadFn", () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    stack.open({ key: ["a"], payload: { n: 1 } });
    stack.open({ key: ["b"], payload: { n: 2 } });
    const snap = stack.getSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap[0]?.index).toBe(0);
    expect(snap[1]?.index).toBe(1);
    expect(snap[1]?.stackSize).toBe(2);
    expect(snap[0]?.phase).toBe("active");
    expect(snap[0]?.transition).toBe("settled");
  });

  it("upsert reuses an existing key and merges payload", () => {
    const stack = new LayerStack<{ msg: string }, void>("s");
    stack.open({ key: ["toast"], payload: { msg: "a" }, upsert: true });
    stack.open({ key: ["toast"], payload: { msg: "b" }, upsert: true });
    const snap = stack.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.payload.msg).toBe("b");
  });

  it("onLayerDismiss fires with the layer when dismiss is called", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["c"], payload: { n: 1 } });
    let dismissed: typeof layer | undefined;
    stack.onLayerDismiss = (l) => {
      dismissed = l;
    };
    await stack.dismiss(layer, true);
    expect(dismissed).toBe(layer);
  });

  it("dismiss resolves the caller promise and removes the layer", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["c"], payload: { n: 1 } });
    const pending = layer.promise.promise;
    await stack.dismiss(layer, true);
    expect(await pending).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("update patches payload live", () => {
    const stack = new LayerStack<{ msg: string }, void>("s");
    const layer = stack.open({ key: ["t"], payload: { msg: "a" } });
    stack.update(layer, { msg: "b" });
    expect(stack.getSnapshot()[0]?.payload.msg).toBe("b");
  });

  it("setRunning flips actionStatus on the snapshot", () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    const layer = stack.open({ key: ["r"], payload: { n: 1 } });
    expect(stack.getSnapshot()[0]?.actionStatus).toBe("idle");
    stack.setRunning(layer, true);
    expect(stack.getSnapshot()[0]?.actionStatus).toBe("running");
    stack.setRunning(layer, false);
    expect(stack.getSnapshot()[0]?.actionStatus).toBe("idle");
  });

  it("notify batches multiple mutations into one listener call", () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    let calls = 0;
    stack.subscribe(() => {
      calls++;
    });
    notifyManager.batch(() => {
      stack.open({ key: ["a"], payload: { n: 1 } });
      stack.open({ key: ["b"], payload: { n: 2 } });
    });
    expect(calls).toBe(1);
  });

  it("no-op mutations do not notify subscribers", () => {
    const stack = new LayerStack<{ msg: string }, void>("s");
    const layer = stack.open({ key: ["n"], payload: { msg: "a" } });
    let calls = 0;
    stack.subscribe(() => {
      calls++;
    });
    stack.setRunning(layer, false);
    expect(calls).toBe(0);
    stack.setRunning(layer, true);
    expect(calls).toBe(1);
    stack.setRunning(layer, true);
    expect(calls).toBe(1);
  });
});

describe("LayerStack — instance identity", () => {
  it("parallel stack: same key twice yields distinct ids; dismiss removes one", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const first = stack.open({ key: ["dup"], payload: { n: 1 } });
    const second = stack.open({ key: ["dup"], payload: { n: 2 } });
    const snap = stack.getSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap[0]?.id).not.toBe(snap[1]?.id);
    expect(snap[0]?.id).toMatch(/^[^#]+#\d+$/);
    expect(snap[1]?.id).toMatch(/^[^#]+#\d+$/);

    await stack.dismiss(first, true);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(2);
    expect(stack.getLayer(second.id)).toBe(second);
    expect(stack.find(["dup"])).toBe(second);

    const pending = second.promise.promise;
    await stack.dismiss(second, false);
    expect(await pending).toBe(false);
  });

  it("upsert still merges by key when same key opened twice", () => {
    const stack = new LayerStack<{ msg: string }, void>("s");
    stack.open({ key: ["toast"], payload: { msg: "a" }, upsert: true });
    stack.open({ key: ["toast"], payload: { msg: "b" }, upsert: true });
    const snap = stack.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.payload.msg).toBe("b");
  });
});

describe("LayerStack — loadFn", () => {
  it("pending → active with data on success", async () => {
    const stack = new LayerStack<{ id: number }, void, Error, string>("s");
    const layer = stack.open({
      key: ["d"],
      payload: { id: 1 },
      loadFn: async () => "loaded",
    });
    expect(stack.getSnapshot()[0]?.phase).toBe("pending");
    await Promise.resolve();
    await Promise.resolve();
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getSnapshot()[0]?.data).toBe("loaded");
    void layer;
  });

  it("error phase + rejects the promise on throw", async () => {
    const stack = new LayerStack<{ id: number }, void, Error, string>("s");
    const layer = stack.open({
      key: ["e"],
      payload: { id: 1 },
      loadFn: async () => {
        throw new Error("boom");
      },
    });
    await expect(layer.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()[0]?.phase).toBe("error");
    expect(stack.getSnapshot()[0]?.error?.message).toBe("boom");
  });

  it("cancel: dismiss during pending aborts and ignores late resolution", async () => {
    let resolved = false;
    const stack = new LayerStack<{ id: number }, boolean, Error, string>("s");
    const layer = stack.open({
      key: ["f"],
      payload: { id: 1 },
      loadFn: async ({ signal }) => {
        await new Promise<void>((r) => setTimeout(r, 5));
        if (signal.aborted) {
          return "";
        }
        resolved = true;
        return "late";
      },
    });
    await stack.dismiss(layer, false);
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(0);
  });
});

describe("LayerStack — scope serial", () => {
  it("queues the second open behind an active layer; activates on dismiss", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    // Only `a` is rendered; `b` is queued.
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(1);
    expect(stack.getQueuedSnapshot()).toHaveLength(1);
    expect(stack.getQueuedSnapshot()[0]?.payload.n).toBe(2);
    expect(stack.getQueuedSnapshot()[0]?.phase).toBe("queued");

    await stack.dismiss(a, true);
    // `b` activates after `a` is removed.
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(2);
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getQueuedSnapshot()).toHaveLength(0);

    const bp = b.promise.promise;
    await stack.dismiss(b, false);
    expect(await bp).toBe(false);
  });

  it("dismissAll resolves queued layers without mounting them", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    expect(stack.getQueuedSnapshot()).toHaveLength(1);
    await stack.dismissAll(true);
    expect(await a.promise.promise).toBe(true);
    expect(await b.promise.promise).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);
  });

  it("onLoadError block (default): error occupies lane; queued waits; no leapfrog", async () => {
    let rejectLoad!: (error: Error) => void;
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: () =>
        new Promise<never>((_, reject) => {
          rejectLoad = reject;
        }),
    });
    stack.open({ key: ["b"], payload: { n: 2 } });
    expect(stack.getQueuedSnapshot()).toHaveLength(1);

    rejectLoad(new Error("boom"));
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()).toEqual([
      expect.objectContaining({ phase: "error", payload: { n: 1 } }),
    ]);
    expect(stack.getQueuedSnapshot()).toEqual([
      expect.objectContaining({ phase: "queued", payload: { n: 2 } }),
    ]);

    const c = stack.open({ key: ["c"], payload: { n: 3 } });
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getQueuedSnapshot().map((l) => l.payload.n)).toEqual([2, 3]);
    expect(c.state.phase).toBe("queued");

    await stack.dismiss(a, false);
    expect(stack.getSnapshot()).toEqual([
      expect.objectContaining({ phase: "active", payload: { n: 2 } }),
    ]);
    expect(stack.getQueuedSnapshot()).toEqual([
      expect.objectContaining({ payload: { n: 3 } }),
    ]);
  });

  it("onLoadError advance: reject removes layer and drains queue", async () => {
    let rejectLoad!: (error: Error) => void;
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "serial", onLoadError: "advance" },
    });
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: () =>
        new Promise<never>((_, reject) => {
          rejectLoad = reject;
        }),
    });
    stack.open({ key: ["b"], payload: { n: 2 } });
    expect(stack.getQueuedSnapshot()).toHaveLength(1);

    rejectLoad(new Error("boom"));
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()).toEqual([
      expect.objectContaining({ phase: "active", payload: { n: 2 } }),
    ]);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);

    const c = stack.open({ key: ["c"], payload: { n: 3 } });
    expect(c.state.phase).toBe("queued");
    expect(stack.getQueuedSnapshot().map((l) => l.payload.n)).toEqual([3]);
  });

  it("onLoadError advance: empty queue clears the failed layer", async () => {
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "serial", onLoadError: "advance" },
    });
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: async () => {
        throw new Error("boom");
      },
    });
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);
  });

  it("onLoadError advance: fires onLayerDismiss before remove", async () => {
    const dismissed: string[] = [];
    let phaseAtHook: string | undefined;
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "serial", onLoadError: "advance" },
    });
    stack.onLayerDismiss = (layer) => {
      dismissed.push(layer.id);
      phaseAtHook = layer.state.phase;
    };
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: async () => {
        throw new Error("boom");
      },
    });
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(dismissed).toEqual([a.id]);
    expect(phaseAtHook).toBe("dismissed");
  });

  it("onLoadError advance: dismiss on failed handle is a no-op for the next layer", async () => {
    let rejectLoad!: (error: Error) => void;
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "serial", onLoadError: "advance" },
    });
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: () =>
        new Promise<never>((_, reject) => {
          rejectLoad = reject;
        }),
    });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    rejectLoad(new Error("boom"));
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()[0]?.id).toBe(b.id);

    await expect(stack.dismiss(a, false)).resolves.toBe(true);
    expect(stack.getSnapshot()).toEqual([
      expect.objectContaining({ id: b.id, phase: "active" }),
    ]);
    await expect(a.promise.promise).rejects.toThrow("boom");
  });

  it("onLoadError advance is ignored on parallel stacks", async () => {
    const stack = new LayerStack<{ n: number }, boolean, Error>("s", {
      scope: { strategy: "parallel", onLoadError: "advance" },
    });
    const a = stack.open({
      key: ["a"],
      payload: { n: 1 },
      loadFn: async () => {
        throw new Error("boom");
      },
    });
    await expect(a.promise.promise).rejects.toThrow("boom");
    expect(stack.getSnapshot()).toEqual([
      expect.objectContaining({ phase: "error", payload: { n: 1 } }),
    ]);
  });

  it("cancelQueued resolves a queued layer without mounting it", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    expect(stack.getQueuedSnapshot()[0]?.phase).toBe("queued");
    const bp = b.promise.promise;
    expect(stack.cancelQueued(["b"], false)).toBe(true);
    expect(await bp).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(1);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);

    await stack.dismiss(a, true);
    expect(stack.getSnapshot()).toHaveLength(0);
    void a;
  });

  it("cancelQueued returns false for a key not in the queue", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    expect(stack.cancelQueued(["missing"], false)).toBe(false);
  });

  it("cancelQueued by id removes exact queued instance", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["k"], payload: { n: 2 } });
    const c = stack.open({ key: ["k"], payload: { n: 3 } });
    const cp = c.promise.promise;
    expect(stack.cancelQueued(["k"], false, { id: c.id })).toBe(true);
    expect(await cp).toBe(false);
    expect(stack.getQueuedSnapshot()).toHaveLength(1);
    expect(stack.getQueuedSnapshot()[0]?.id).toBe(b.id);
    expect(stack.getSnapshot()[0]?.id).toBe(a.id);
    await stack.dismiss(a, true);
    void b;
  });

  it("cancelQueued by id returns false for unknown id", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    stack.open({ key: ["k"], payload: { n: 2 } });
    expect(stack.cancelQueued(["k"], false, { id: "missing" })).toBe(false);
  });

  it("cancelQueued without id cancels FIFO head", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["k"], payload: { n: 2 } });
    const c = stack.open({ key: ["k"], payload: { n: 3 } });
    const bp = b.promise.promise;
    expect(stack.cancelQueued(["k"], false)).toBe(true);
    expect(await bp).toBe(false);
    expect(stack.getQueuedSnapshot()).toHaveLength(1);
    expect(stack.getQueuedSnapshot()[0]?.id).toBe(c.id);
  });

  it("cancelQueued by id returns false for mounted layer", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    expect(stack.cancelQueued(["a"], false, { id: a.id })).toBe(false);
  });

  it("cancelQueued by id returns false when id is queued under a different key", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    expect(stack.cancelQueued(["k"], false, { id: b.id })).toBe(false);
    expect(stack.getQueuedSnapshot()[0]?.id).toBe(b.id);
  });

  it("cancelQueued by id removes middle of three same-key queued", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["k"], payload: { n: 2 } });
    const c = stack.open({ key: ["k"], payload: { n: 3 } });
    const d = stack.open({ key: ["k"], payload: { n: 4 } });
    const cp = c.promise.promise;
    expect(stack.cancelQueued(["k"], false, { id: c.id })).toBe(true);
    expect(await cp).toBe(false);
    expect(stack.getQueuedSnapshot().map((l) => l.id)).toEqual([b.id, d.id]);
  });

  it("cancelQueued with empty opts cancels FIFO head", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["k"], payload: { n: 2 } });
    const c = stack.open({ key: ["k"], payload: { n: 3 } });
    const bp = b.promise.promise;
    expect(stack.cancelQueued(["k"], false, {})).toBe(true);
    expect(await bp).toBe(false);
    expect(stack.getQueuedSnapshot()[0]?.id).toBe(c.id);
  });
});

describe("LayerStack — gcTime", () => {
  it("restores data on re-open without re-running loadFn", async () => {
    let loadCalls = 0;
    const stack = new LayerStack<{ id: number }, boolean, Error, string>("s", {
      gcTime: 1000,
    });
    const a = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "data";
      },
    });
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    await stack.dismiss(a, true);
    // Re-open same key within gcTime → data restored, no new loadFn call.
    const b = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "should-not-run";
      },
    });
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getSnapshot()[0]?.data).toBe("data");
    expect(loadCalls).toBe(1);
    await stack.dismiss(b, true);
  });

  it("cached layer ends dismissed + settled after dismiss with gcTime", async () => {
    let loadCalls = 0;
    const stack = new LayerStack<{ id: number }, boolean, Error, string>("s", {
      gcTime: 1000,
    });
    const a = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "data";
      },
    });
    await new Promise<void>((r) => setTimeout(r, 5));
    await stack.dismiss(a, true);
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(a.state.phase).toBe("dismissed");
    expect(a.state.transition).toBe("settled");
    const b = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "should-not-run";
      },
    });
    expect(b.state.phase).toBe("active");
    expect(b.state.transition).toBe("settled");
    expect(loadCalls).toBe(1);
    await stack.dismiss(b, true);
  });

  it("parallel stack: same-key LWW restores most-recently-dismissed data", async () => {
    let loadCalls = 0;
    const stack = new LayerStack<{ id: number }, boolean, Error, string>("s", {
      gcTime: 1000,
    });
    const first = stack.open({
      key: ["dup"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "first-data";
      },
    });
    const second = stack.open({
      key: ["dup"],
      payload: { id: 2 },
      loadFn: async () => {
        loadCalls++;
        return "second-data";
      },
    });
    await new Promise<void>((r) => setTimeout(r, 5));
    expect(stack.getSnapshot()).toHaveLength(2);
    await stack.dismiss(first, true);
    await stack.dismiss(second, true);

    const restored = stack.open({
      key: ["dup"],
      payload: { id: 3 },
      loadFn: async () => {
        loadCalls++;
        return "should-not-run";
      },
    });
    expect(stack.getSnapshot()[0]?.data).toBe("second-data");
    expect(loadCalls).toBe(2);
    await stack.dismiss(restored, true);
  });
});

describe("LayerStack — transitions", () => {
  it("enteringDelay 0 → settled immediately on open", () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    stack.open({ key: ["a"], payload: { n: 1 } });
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
  });

  it("enteringDelay > 0 → entering then settled after delay", async () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    stack.open({ key: ["a"], payload: { n: 1 }, enteringDelay: 5 });
    expect(stack.getSnapshot()[0]?.transition).toBe("entering");
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
  });

  it("settle during entering → settled immediately, timer cleared", async () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    const layer = stack.open({
      key: ["a"],
      payload: { n: 1 },
      enteringDelay: 50,
    });
    expect(stack.getSnapshot()[0]?.transition).toBe("entering");
    stack.settle(layer);
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
    await new Promise<void>((r) => setTimeout(r, 60));
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
  });

  it("settle during exiting → removes immediately before exitingDelay", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({
      key: ["a"],
      payload: { n: 1 },
      exitingDelay: 50,
    });
    await stack.dismiss(layer, true);
    expect(stack.getSnapshot()[0]?.phase).toBe("dismissed");
    expect(stack.getSnapshot()[0]?.transition).toBe("exiting");
    stack.settle(layer);
    expect(stack.getSnapshot()).toHaveLength(0);
    await new Promise<void>((r) => setTimeout(r, 60));
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("exitingDelay > 0 → dismissed + exiting until delay, then removed", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({
      key: ["a"],
      payload: { n: 1 },
      exitingDelay: 5,
    });
    await stack.dismiss(layer, true);
    expect(stack.getSnapshot()[0]?.phase).toBe("dismissed");
    expect(stack.getSnapshot()[0]?.transition).toBe("exiting");
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("soft dismiss during exiting does not stick dismissing true", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({
      key: ["a"],
      payload: { n: 1 },
      exitingDelay: 50,
    });
    await stack.dismiss(layer, true);
    expect(stack.getSnapshot()[0]?.transition).toBe("exiting");
    expect(await stack.dismiss(layer, true)).toBe(true);
    expect(stack.getSnapshot()[0]?.dismissing).toBe(false);
  });

  it("settle during entering leaves phase untouched (pending load)", async () => {
    const stack = new LayerStack<{ id: number }, void, Error, string>("s");
    const layer = stack.open({
      key: ["d"],
      payload: { id: 1 },
      enteringDelay: 50,
      loadFn: async () => {
        await new Promise<void>((r) => setTimeout(r, 100));
        return "loaded";
      },
    });
    expect(stack.getSnapshot()[0]?.phase).toBe("pending");
    expect(stack.getSnapshot()[0]?.transition).toBe("entering");
    stack.settle(layer);
    expect(stack.getSnapshot()[0]?.phase).toBe("pending");
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
  });
});

describe("LayerStack — validate", () => {
  /** Raw open input before slice B conditional payload typing. */
  const raw = <P>(payload: unknown) => payload as P;

  it("valid + coercion: plain-fn validator stores parsed output", () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = (input: unknown) => {
      const raw = input as { id: string };
      return { id: Number(raw.id) };
    };
    stack.open({ key: ["v"], payload: raw({ id: "42" }), validate });
    expect(stack.getSnapshot()[0]?.payload).toEqual({ id: 42 });
  });

  it("valid + coercion: Standard-Schema-shaped validator stores parsed output", () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (v: unknown) => {
          const raw = v as { id: string };
          if (!raw?.id) {
            return { issues: [{ message: "id required" }] };
          }
          return { value: { id: Number(raw.id) } };
        },
      },
    };
    stack.open({ key: ["v"], payload: raw({ id: "7" }), validate });
    expect(stack.getSnapshot()[0]?.payload).toEqual({ id: 7 });
  });

  it("invalid → reject + no mount (plain fn)", async () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = () => {
      throw new Error("bad input");
    };
    const layer = stack.open({
      key: ["bad"],
      payload: { id: 1 },
      validate,
    });
    const err = await layer.promise.promise.catch((e: unknown) => e);
    expect(isPayloadValidationError(err)).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("invalid → reject + no mount (Standard Schema issues)", async () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: () => ({ issues: [{ message: "invalid", path: ["id"] }] }),
      },
    };
    const layer = stack.open({
      key: ["bad"],
      payload: raw({ id: "x" }),
      validate,
    });
    const err = await layer.promise.promise.catch((e: unknown) => e);
    expect(isPayloadValidationError(err)).toBe(true);
    expect((err as PayloadValidationError).issues[0]?.message).toBe("invalid");
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("async schema → reject with config error", async () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: () => Promise.resolve({ value: { id: 1 } }),
      },
    };
    const layer = stack.open({
      key: ["async"],
      payload: { id: 1 },
      validate,
    });
    await expect(layer.promise.promise).rejects.toThrow(/async/i);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("upsert re-validates and stores parsed output", () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = (input: unknown) => {
      const raw = input as { id: string };
      return { id: Number(raw.id) };
    };
    stack.open({
      key: ["toast"],
      payload: raw({ id: "1" }),
      validate,
      upsert: true,
    });
    stack.open({
      key: ["toast"],
      payload: raw({ id: "99" }),
      validate,
      upsert: true,
    });
    const snap = stack.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.payload).toEqual({ id: 99 });
  });

  it("upsert with invalid payload rejects and leaves existing layer unchanged", async () => {
    const stack = new LayerStack<{ id: number }, void>("s");
    const validate = (input: unknown) => {
      const raw = input as { id: string };
      if (raw.id === "bad") throw new Error("invalid");
      return { id: Number(raw.id) };
    };
    stack.open({
      key: ["toast"],
      payload: raw({ id: "1" }),
      validate,
      upsert: true,
    });
    const layer = stack.open({
      key: ["toast"],
      payload: raw({ id: "bad" }),
      validate,
      upsert: true,
    });
    const err = await layer.promise.promise.catch((e: unknown) => e);
    expect(isPayloadValidationError(err)).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload).toEqual({ id: 1 });
  });
});

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("LayerStack — blockers", () => {
  it("instance blocker veto keeps layer open", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    layer.addBlocker(() => false);
    const ok = await stack.dismiss(layer, true);
    expect(ok).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
  });

  it("stack blocker veto keeps layer open", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    stack.addBlocker(() => false);
    const ok = await stack.dismiss(layer, true);
    expect(ok).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
  });

  it("disposer removes a blocker so dismiss succeeds", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const dispose = layer.addBlocker(() => false);
    expect(await stack.dismiss(layer, true)).toBe(false);
    dispose();
    expect(await stack.dismiss(layer, true)).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("async predicate awaited — allow dismisses, veto keeps open", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const allow = deferred<boolean>();
    layer.addBlocker(() => allow.promise);
    const pending = stack.dismiss(layer, true);
    allow.resolve(true);
    expect(await pending).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);

    const layer2 = stack.open({ key: ["b"], payload: { n: 2 } });
    const deny = deferred<boolean>();
    layer2.addBlocker(() => deny.promise);
    const pending2 = stack.dismiss(layer2, true);
    deny.resolve(false);
    expect(await pending2).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
  });

  it("{ force: true } bypasses a veto", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    layer.addBlocker(() => false);
    expect(await stack.dismiss(layer, true, { force: true })).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("dedupes concurrent dismiss calls on the same layer", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const gate = deferred<boolean>();
    let checks = 0;
    layer.addBlocker(() => {
      checks++;
      return gate.promise;
    });
    const first = stack.dismiss(layer, true);
    const second = stack.dismiss(layer, true);
    expect(first).toBe(second);
    gate.resolve(true);
    expect(await first).toBe(true);
    expect(checks).toBe(1);
    expect(stack.getSnapshot()).toHaveLength(0);
  });

  it("fail-closed: throwing predicate vetoes dismiss", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    layer.addBlocker(() => {
      throw new Error("boom");
    });
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await stack.dismiss(layer, true)).toBe(false);
    } finally {
      console.warn = warn;
    }
    expect(stack.getSnapshot()).toHaveLength(1);
  });

  it("dismissing toggles true during async predicate then false on veto", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const gate = deferred<boolean>();
    layer.addBlocker(() => gate.promise);
    const pending = stack.dismiss(layer, true);
    await Promise.resolve();
    expect(stack.getSnapshot()[0]?.dismissing).toBe(true);
    gate.resolve(false);
    expect(await pending).toBe(false);
    expect(stack.getSnapshot()[0]?.dismissing).toBe(false);
  });

  it("dismissAll skipBlocked closes unblocked and leaves blocked", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    b.addBlocker(() => false);
    await stack.dismissAll(true, { mode: "skipBlocked" });
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(2);
    expect(await a.promise.promise).toBe(true);
    let bResolved = false;
    void b.promise.promise.then(() => {
      bResolved = true;
    });
    await Promise.resolve();
    expect(bResolved).toBe(false);
    await stack.dismiss(b, true, { force: true });
  });

  it("dismissAll stopAtBlocked halts at first blocked layer", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    const c = stack.open({ key: ["c"], payload: { n: 3 } });
    b.addBlocker(() => false);
    await stack.dismissAll(true, { mode: "stopAtBlocked" });
    expect(stack.getSnapshot()).toHaveLength(2);
    expect(stack.getSnapshot()[0]?.payload.n).toBe(2);
    expect(stack.getSnapshot()[1]?.payload.n).toBe(3);
    expect(await a.promise.promise).toBe(true);
    await stack.dismiss(b, true, { force: true });
    await stack.dismiss(c, true);
    void c;
  });

  it("dismissAll force closes all layers despite blockers", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const a = stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    a.addBlocker(() => false);
    b.addBlocker(() => false);
    await stack.dismissAll(true, { mode: "force" });
    expect(stack.getSnapshot()).toHaveLength(0);
    expect(await a.promise.promise).toBe(true);
    expect(await b.promise.promise).toBe(true);
  });

  it("cancelQueued ignores blockers", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s", {
      scope: { strategy: "serial" },
    });
    stack.open({ key: ["a"], payload: { n: 1 } });
    const b = stack.open({ key: ["b"], payload: { n: 2 } });
    stack.addBlocker(() => false);
    const bp = b.promise.promise;
    expect(stack.cancelQueued(["b"], false)).toBe(true);
    expect(await bp).toBe(false);
    expect(stack.getQueuedSnapshot()).toHaveLength(0);
  });

  it("cached-layer restore ignores blockers on re-open dismiss", async () => {
    let loadCalls = 0;
    const stack = new LayerStack<{ id: number }, boolean, Error, string>("s", {
      gcTime: 1000,
    });
    const a = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => {
        loadCalls++;
        return "data";
      },
    });
    await new Promise<void>((r) => setTimeout(r, 5));
    await stack.dismiss(a, true);
    const b = stack.open({
      key: ["g"],
      payload: { id: 1 },
      loadFn: async () => "should-not-run",
    });
    b.addBlocker(() => false);
    expect(await stack.dismiss(b, true)).toBe(false);
    expect(stack.getSnapshot()).toHaveLength(1);
    expect(loadCalls).toBe(1);
  });
});

describe("LayerClient", () => {
  it("open returns a promise that resolves on dismiss", async () => {
    const client = new LayerClient();
    const confirm = layerOptions<{ n: number }, boolean>({
      stack: "confirm",
      key: ["confirm", "x"],
    });
    const pending = client.open({ ...confirm, payload: { n: 1 } });
    const stack = client.getStack("confirm") as unknown as LayerStack<
      { n: number },
      boolean
    >;
    const layer = stack.find(["confirm", "x"]);
    expect(layer).toBeDefined();
    await stack.dismiss(layer!, true);
    expect(await pending).toBe(true);
  });

  it("stacks are isolated by id", () => {
    const client = new LayerClient();
    client.open({ key: ["a"], payload: 1, stack: "modal" });
    client.open({ key: ["b"], payload: 2, stack: "toast" });
    expect(client.getStack("modal").getSnapshot()).toHaveLength(1);
    expect(client.getStack("toast").getSnapshot()).toHaveLength(1);
  });
});
