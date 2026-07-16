import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const contextStore = new Map<symbol, unknown>();

mock.module("svelte", () => ({
  setContext: (key: symbol, value: unknown) => {
    contextStore.set(key, value);
  },
  getContext: <T>(key: symbol) => contextStore.get(key) as T | undefined,
  onDestroy: () => {},
}));

mock.module("svelte/reactivity", () => ({
  createSubscriber: (_start: (update: () => void) => () => void) => () => {},
}));

let LayerClient: typeof import("@stainless-code/layers").LayerClient;
let layerOptions: typeof import("@stainless-code/layers").layerOptions;
let createLayer: typeof import("./index").createLayer;
let createLayerState: typeof import("./index").createLayerState;
let createQueuedStack: typeof import("./index").createQueuedStack;
let setLayerClient: typeof import("./index").setLayerClient;
let useLayerClient: typeof import("./index").useLayerClient;
let useStack: typeof import("./index").useStack;

beforeAll(async () => {
  ({ LayerClient, layerOptions } = await import("@stainless-code/layers"));
  ({
    createLayer,
    createLayerState,
    createQueuedStack,
    setLayerClient,
    useLayerClient,
    useStack,
  } = await import("./index"));
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
    const stack = useStack({ stack: "confirm" }, client);
    expect(stack.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
    expect(stack.current[0]?.payload).toBe(1);
  });

  it("callFor builds a call context that ends the layer", async () => {
    const client = new LayerClient();
    const stack = useStack({ stack: "confirm" }, client);
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

  it("with select returns the selected slice", () => {
    const client = new LayerClient();
    const stack = useStack(
      { stack: "confirm", select: (states) => states.length },
      client,
    );
    expect(stack.current).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toBe(1);
  });

  it("createLayerState returns matching layer states as an array", () => {
    const client = new LayerClient();
    const layer = createLayerState({ key: ["a"], stack: "confirm" }, client);
    expect(layer.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer.current).toHaveLength(1);
    expect(layer.current[0]?.payload).toBe(1);
    expect(layer.current[0]?.key).toEqual(["a"]);
  });

  it("createQueuedStack reads queued snapshot", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const queued = createQueuedStack(
      { stack: "default", select: (s) => s.length },
      client,
    );
    expect(queued.current).toBe(0);
    void client.open({ key: ["a"], payload: 1 });
    void client.open({ key: ["b"], payload: 2 });
    expect(queued.current).toBe(1);
  });

  it("useStack reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const stack = useStack({ stack: "confirm" });
    expect(stack.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
    expect(stack.current[0]?.payload).toBe(1);
  });

  it("createLayerState reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const layer = createLayerState({ key: ["a"], stack: "confirm" });
    expect(layer.current).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer.current).toHaveLength(1);
    expect(layer.current[0]?.payload).toBe(1);
  });

  it("createLayer exposes handle control and reactive state", async () => {
    const client = new LayerClient();
    setLayerClient(client);
    const opts = layerOptions<{ msg: string }, void>({
      key: ["toast"],
      exitingDelay: 0,
    });
    const handle = createLayer(opts);
    expect(handle.state).toEqual([]);
    expect(handle.top).toBeNull();
    expect(handle.current).toBeNull();

    const pending = handle.open({ msg: "hi" });
    expect(handle.state).toHaveLength(1);
    expect(handle.top?.payload.msg).toBe("hi");
    expect(handle.current).not.toBeNull();

    await handle.dismiss(undefined as void);
    expect(await pending).toBeUndefined();
    expect(handle.state).toEqual([]);
  });

  // The reactive auto-update + subscription cleanup need a Svelte component
  // context (`createSubscriber`'s start runs lazily inside an owner); outside
  // one, `subscribe()` is a no-op. The value contract above is what's
  // exercisable in bun; the LayerStack subscription is pinned in core tests.
});
