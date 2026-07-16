import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

import type { LayerState } from "@stainless-code/layers";

const contextStore = new Map<symbol, unknown>();

mock.module("svelte", () => ({
  setContext: (key: symbol, value: unknown) => {
    contextStore.set(key, value);
  },
  getContext: <T>(key: symbol) => contextStore.get(key) as T | undefined,
  onDestroy: () => {},
}));

let LayerClient: typeof import("@stainless-code/layers").LayerClient;
let layerOptions: typeof import("@stainless-code/layers").layerOptions;
let callFor: typeof import("./store").callFor;
let createLayer: typeof import("./store").createLayer;
let createLayerState: typeof import("./store").createLayerState;
let createQueuedStack: typeof import("./store").createQueuedStack;
let setLayerClient: typeof import("./store").setLayerClient;
let useLayerClient: typeof import("./store").useLayerClient;
let useStack: typeof import("./store").useStack;

beforeAll(async () => {
  ({ LayerClient, layerOptions } = await import("@stainless-code/layers"));
  ({
    callFor,
    createLayer,
    createLayerState,
    createQueuedStack,
    setLayerClient,
    useLayerClient,
    useStack,
  } = await import("./store"));
});

beforeEach(() => {
  contextStore.clear();
});

function subscribe<T>(store: {
  subscribe: (fn: (v: T) => void) => () => void;
}) {
  let value: T | undefined;
  const unsub = store.subscribe((v) => {
    value = v;
  });
  return {
    get value() {
      return value as T;
    },
    unsub,
  };
}

describe("setLayerClient / useLayerClient", () => {
  it("useLayerClient returns the client set by setLayerClient", () => {
    const client = new LayerClient();
    setLayerClient(client);
    expect(useLayerClient()).toBe(client);
  });

  it("useLayerClient throws when no client is in context", () => {
    expect(() => useLayerClient()).toThrow(
      "[layers/svelte-store] No LayerClient in context — call setLayerClient() in a parent component.",
    );
  });
});

describe("useStack (svelte store)", () => {
  it("subscribes to stack snapshots and cleans up on unsubscribe", () => {
    const client = new LayerClient();
    const store = useStack({ stack: "confirm" }, client);
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    expect(sub.value).toHaveLength(0);

    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);

    sub.unsub();
    expect(client.getStack("confirm").size).toBe(0);
  });

  it("with select returns the selected slice", () => {
    const client = new LayerClient();
    const store = useStack(
      { stack: "confirm", select: (states) => states.length },
      client,
    );
    const sub = subscribe(store);

    expect(sub.value).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toBe(1);

    sub.unsub();
  });

  it("reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const store = useStack({ stack: "confirm" });
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);

    sub.unsub();
  });

  it("createQueuedStack subscribes to queued snapshot", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const store = createQueuedStack({ select: (s) => s.length }, client);
    const sub = subscribe(store);
    expect(sub.value).toBe(0);
    void client.open({ key: ["a"], payload: 1 });
    void client.open({ key: ["b"], payload: 2 });
    expect(sub.value).toBe(1);
    sub.unsub();
  });
});

describe("createLayerState (svelte store)", () => {
  it("yields empty array then matching layer states", () => {
    const client = new LayerClient();
    const store = createLayerState({ key: ["a"], stack: "confirm" }, client);
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);
    expect(sub.value[0]?.payload).toBe(1);

    sub.unsub();
  });

  it("reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const store = createLayerState({ key: ["a"], stack: "confirm" });
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);
    expect(sub.value[0]?.payload).toBe(1);

    sub.unsub();
  });
});

describe("createLayer (svelte store)", () => {
  it("exposes handle control and reactive state stores", async () => {
    const client = new LayerClient();
    setLayerClient(client);
    const opts = layerOptions<{ msg: string }, void>({
      key: ["toast"],
      exitingDelay: 0,
    });
    const handle = createLayer(opts);
    const state = subscribe(handle.state);
    const top = subscribe(handle.top);

    expect(state.value).toEqual([]);
    expect(top.value).toBeNull();
    expect(handle.current).toBeNull();

    const pending = handle.open({ msg: "hi" });
    expect(state.value).toHaveLength(1);
    expect(top.value?.payload.msg).toBe("hi");

    await handle.dismiss(undefined as void);
    expect(await pending).toBeUndefined();
    expect(state.value).toEqual([]);

    state.unsub();
    top.unsub();
  });
});

describe("callFor", () => {
  it("returns a call context for a live state and null for a bogus state", async () => {
    const client = new LayerClient();
    const store = useStack({ stack: "confirm" }, client);
    const sub = subscribe(store);

    const pending = client.open<number, boolean>({
      key: ["b"],
      payload: 2,
      stack: "confirm",
    });
    const state = sub.value[0]!;

    const call = callFor(client, "confirm", state);
    expect(call).not.toBeNull();
    call!.end(true);
    expect(await pending).toBe(true);

    const bogus: LayerState = {
      id: "nope",
      key: ["b"],
      payload: 2,
      phase: "active",
      transition: "settled",
      actionStatus: "idle",
      dismissing: false,
      ended: false,
      index: 0,
      stackSize: 0,
    };
    expect(callFor(client, "confirm", bogus)).toBeNull();

    sub.unsub();
  });
});
