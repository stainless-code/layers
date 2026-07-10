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
let callFor: typeof import("./store").callFor;
let setLayerClient: typeof import("./store").setLayerClient;
let useLayer: typeof import("./store").useLayer;
let useLayerClient: typeof import("./store").useLayerClient;
let useStack: typeof import("./store").useStack;

beforeAll(async () => {
  ({ LayerClient } = await import("@stainless-code/layers"));
  ({ callFor, setLayerClient, useLayer, useLayerClient, useStack } =
    await import("./store"));
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
    const store = useStack(client, "confirm");
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    expect(sub.value).toHaveLength(0);

    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);

    sub.unsub();
    expect(client.getStack("confirm").size).toBe(0);
  });

  it("with a selector returns the selected slice", () => {
    const client = new LayerClient();
    const store = useStack(client, "confirm", (states) => states.length);
    const sub = subscribe(store);

    expect(sub.value).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toBe(1);

    sub.unsub();
  });

  it("reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const store = useStack("confirm");
    const sub = subscribe(store);

    expect(sub.value).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value).toHaveLength(1);

    sub.unsub();
  });
});

describe("useLayer (svelte store)", () => {
  it("yields null then the matching layer state", () => {
    const client = new LayerClient();
    const store = useLayer(client, ["a"], "confirm");
    const sub = subscribe(store);

    expect(sub.value).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value?.payload).toBe(1);

    sub.unsub();
  });

  it("reads client from context when omitted", () => {
    const client = new LayerClient();
    setLayerClient(client);
    const store = useLayer(["a"], "confirm");
    const sub = subscribe(store);

    expect(sub.value).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(sub.value?.payload).toBe(1);

    sub.unsub();
  });
});

describe("callFor", () => {
  it("returns a call context for a live state and null for a bogus state", async () => {
    const client = new LayerClient();
    const store = useStack(client, "confirm");
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
