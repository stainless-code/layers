import { beforeAll, describe, expect, it, mock } from "bun:test";

// Bun resolves `solid-js` to the SSR build (`createEffect` is a no-op). Point
// the test at the client build for reactive coverage.
mock.module(
  "solid-js",
  // @ts-expect-error client bundle — no `.d.ts` subpath; runtime-only for tests.
  () => import("solid-js/dist/solid.js"),
);

let createEffect: typeof import("solid-js").createEffect;
let createRoot: typeof import("solid-js").createRoot;
let useContext: typeof import("solid-js").useContext;
let LayerClientContext: typeof import("./index").LayerClientContext;
let useLayerState: typeof import("./index").useLayerState;
let useLayerClient: typeof import("./index").useLayerClient;
let useStack: typeof import("./index").useStack;
let LayerClient: typeof import("@stainless-code/layers").LayerClient;

beforeAll(async () => {
  ({ createEffect, createRoot, useContext } = await import("solid-js"));
  ({ LayerClientContext, useLayerState, useLayerClient, useStack } =
    await import("./index"));
  ({ LayerClient } = await import("@stainless-code/layers"));
});

/** Solid schedules effects as microtasks — flush before asserting. */
async function flushEffects() {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }
}

// Context overload (trailing `client`) is not exercised here — Solid's
// `useContext` needs a JSX Provider; type correctness is covered by typecheck.
describe("useStack (solid)", () => {
  it("returns an accessor that updates reactively inside createRoot", async () => {
    const client = new LayerClient();
    await createRoot(async (dispose: () => void) => {
      const stack = useStack({ stack: "confirm" }, client);
      let last: number | undefined;
      createEffect(() => {
        last = stack().length;
      });
      await flushEffects();
      expect(last).toBe(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      await flushEffects();
      expect(last).toBe(1);
      dispose();
    });
  });

  it("with a selector returns the selected slice", async () => {
    const client = new LayerClient();
    await createRoot(async (dispose: () => void) => {
      const stack = useStack(
        { stack: "confirm", select: (states) => states.length },
        client,
      );
      await flushEffects();
      expect(stack()).toBe(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      await flushEffects();
      expect(stack()).toBe(1);
      dispose();
    });
  });

  it("useLayerState returns matching layer states as an array", async () => {
    const client = new LayerClient();
    await createRoot(async (dispose: () => void) => {
      const layers = useLayerState({ key: ["a"], stack: "confirm" }, client);
      await flushEffects();
      expect(layers()).toEqual([]);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      await flushEffects();
      expect(layers()).toHaveLength(1);
      expect(layers()[0]?.payload).toBe(1);
      expect(layers()[0]?.key).toEqual(["a"]);
      dispose();
    });
  });
});

describe("LayerClientContext / useLayerClient", () => {
  it("exports LayerClientContext", () => {
    expect(LayerClientContext).toBeDefined();
  });

  it("useLayerClient throws when no provider is in context", async () => {
    await createRoot(async (dispose: () => void) => {
      expect(useContext(LayerClientContext)).toBeUndefined();
      expect(() => useLayerClient()).toThrow(
        "[layers/solid] No LayerClient in context — wrap your tree with <LayerClientContext.Provider value={client}>.",
      );
      dispose();
    });
  });
});
