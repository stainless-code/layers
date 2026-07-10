import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const contextStore = new Map<symbol, unknown>();

mock.module("svelte", () => ({
  setContext: (key: symbol, value: unknown) => {
    contextStore.set(key, value);
  },
  getContext: <T>(key: symbol) => contextStore.get(key) as T | undefined,
  onDestroy: () => {},
}));

let LayerClient: typeof import("@stainless-code/layers").LayerClient;
let setLayerClient: typeof import("./index").setLayerClient;
let useLayer: typeof import("./index").useLayer;
let useLayerClient: typeof import("./index").useLayerClient;
let useStack: typeof import("./index").useStack;

beforeAll(async () => {
  ({ LayerClient } = await import("@stainless-code/layers"));
  ({ setLayerClient, useLayer, useLayerClient, useStack } =
    await import("./index"));
});

beforeEach(() => {
  contextStore.clear();
});

describe("setLayerClient / useLayerClient", () => {
  it("useLayerClient returns the client set by setLayerClient", () => {
    const client = new LayerClient();
    setLayerClient(client);
    expect(useLayerClient()).toBe(client);
  });

  it("useLayerClient throws when no client is in context", () => {
    expect(() => useLayerClient()).toThrow(
      "[layers/svelte] No LayerClient in context — call setLayerClient() in a parent component.",
    );
  });
});

describe("useStack (svelte 5 runes)", () => {
  it("current mirrors the stack snapshot (value contract)", () => {
    const client = new LayerClient();
    const stack = useStack(client, "confirm");
    expect(stack.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
    expect(stack.current[0]?.payload).toBe(1);
  });

  it("callFor builds a call context that ends the layer", async () => {
    const client = new LayerClient();
    const stack = useStack(client, "confirm");
    const pending = client.open<number, boolean>({
      key: ["b"],
      payload: 2,
      stack: "confirm",
    });
    const state = stack.current[0]!;
    const call = stack.callFor(state);
    expect(call).not.toBeNull();
    call!.end(true);
    expect(await pending).toBe(true);
  });

  it("with a selector returns the selected slice", () => {
    const client = new LayerClient();
    const stack = useStack(client, "confirm", (states) => states.length);
    expect(stack.current).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toBe(1);
  });

  it("useLayer returns the matching layer state or null", () => {
    const client = new LayerClient();
    const layer = useLayer(client, ["a"], "confirm");
    expect(layer.current).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer.current?.payload).toBe(1);
    expect(layer.current?.key).toEqual(["a"]);
  });

  it("useStack reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const stack = useStack("confirm");
    expect(stack.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
    expect(stack.current[0]?.payload).toBe(1);
  });

  it("useLayer reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const layer = useLayer(["a"], "confirm");
    expect(layer.current).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer.current?.payload).toBe(1);
    expect(layer.current?.key).toEqual(["a"]);
  });

  // The reactive auto-update + subscription cleanup need a Svelte component
  // context (`createSubscriber`'s start runs lazily inside an owner); outside
  // one, `subscribe()` is a no-op. The value contract above is what's
  // exercisable in bun; the LayerStack subscription is pinned in core tests.
});
