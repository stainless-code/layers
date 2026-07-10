import { describe, expect, it } from "bun:test";

import { Layer } from "./layer";
import { createLayerGcCache } from "./layerGcCache";

type TestLayer = Layer<{ n: number }, void, Error, string>;

function makeLayer(key: string[], data?: string): TestLayer {
  return new Layer<{ n: number }, void, Error, string>({
    key,
    payload: { n: 1 },
    index: 0,
    stackSize: 1,
    data,
  });
}

describe("createLayerGcCache", () => {
  it("store then take returns the same instance with data; second take misses", () => {
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 1000,
    });
    const layer = makeLayer(["k"], "cached-data");
    cache.maybeStore(layer);
    const restored = cache.take(["k"]);
    expect(restored).toBe(layer);
    expect(restored?.state.data).toBe("cached-data");
    expect(cache.take(["k"])).toBeUndefined();
  });

  it("gcTime <= 0 skips store", () => {
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 0,
    });
    const layer = makeLayer(["k"], "data");
    cache.maybeStore(layer);
    expect(cache.take(["k"])).toBeUndefined();
  });

  it("data === undefined skips store", () => {
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 1000,
    });
    const layer = makeLayer(["k"]);
    cache.maybeStore(layer);
    expect(cache.take(["k"])).toBeUndefined();
  });

  it("timer expiry evicts entry and fires onEvict once", async () => {
    const evicted: TestLayer[] = [];
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 5,
      onEvict: (layer) => evicted.push(layer),
    });
    const layer = makeLayer(["k"], "data");
    cache.maybeStore(layer);
    await new Promise<void>((r) => setTimeout(r, 15));
    expect(cache.take(["k"])).toBeUndefined();
    expect(evicted).toHaveLength(1);
    expect(evicted[0]).toBe(layer);
  });

  it("LWW displacement: second same-key store evicts first via onEvict", () => {
    const evicted: TestLayer[] = [];
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 1000,
      onEvict: (layer) => evicted.push(layer),
    });
    const a = makeLayer(["k"], "a-data");
    const b = makeLayer(["k"], "b-data");
    cache.maybeStore(a);
    cache.maybeStore(b);
    expect(evicted).toHaveLength(1);
    expect(evicted[0]).toBe(a);
    const restored = cache.take(["k"]);
    expect(restored).toBe(b);
    expect(restored?.state.data).toBe("b-data");
  });

  it("take cancels the timer so onEvict is not fired later", async () => {
    const evicted: TestLayer[] = [];
    const cache = createLayerGcCache<{ n: number }, void, Error, string>({
      gcTime: () => 5,
      onEvict: (layer) => evicted.push(layer),
    });
    const layer = makeLayer(["k"], "data");
    cache.maybeStore(layer);
    cache.take(["k"]);
    await new Promise<void>((r) => setTimeout(r, 15));
    expect(evicted).toHaveLength(0);
  });
});
