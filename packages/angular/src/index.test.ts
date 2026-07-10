import { beforeAll, describe, expect, it, mock } from "bun:test";

// Minimal Angular signals stub — signal() + effect() without an injection
// context. effect() runs immediately + registers cleanup via its callback arg.
const cleanups: Array<() => void> = [];
const injectionRegistry = new Map<unknown, unknown>();

class InjectionToken<_T> {
  constructor(public readonly description: string) {}
}

class DestroyRef {}
class ViewContainerRef {}

mock.module("@angular/core", () => ({
  InjectionToken,
  DestroyRef,
  ViewContainerRef,
  inject: <T>(token: InjectionToken<T>): T => {
    if (!injectionRegistry.has(token)) {
      throw new Error(`No provider for ${token.description}`);
    }
    return injectionRegistry.get(token) as T;
  },
  signal: <T>(initial: T) => {
    let value = initial;
    const sig = Object.assign(() => value, {
      set(v: T) {
        value = v;
      },
      update(fn: (prev: T) => T) {
        value = fn(value);
      },
      asReadonly() {
        return sig;
      },
    });
    return sig;
  },
  effect: (fn: (onCleanup: (cleanup: () => void) => void) => void) => {
    fn((cleanup) => {
      cleanups.push(cleanup);
    });
  },
}));

let useLayer: typeof import("./index").useLayer;
let useStack: typeof import("./index").useStack;
let LAYER_CLIENT: typeof import("./index").LAYER_CLIENT;
let provideLayerClient: typeof import("./index").provideLayerClient;
let useLayerClient: typeof import("./index").useLayerClient;
let LayerClient: typeof import("@stainless-code/layers").LayerClient;

beforeAll(async () => {
  ({ useLayer, useStack, LAYER_CLIENT, provideLayerClient, useLayerClient } =
    await import("./index"));
  ({ LayerClient } = await import("@stainless-code/layers"));
});

function runCleanups() {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
}

describe("useStack (angular)", () => {
  it("returns a signal that mirrors the stack", () => {
    const client = new LayerClient();
    const stack = useStack(client, "confirm");
    expect(stack()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toHaveLength(1);
    expect(stack()[0]?.payload).toBe(1);
  });

  it("with a selector returns the selected slice", () => {
    const client = new LayerClient();
    const stack = useStack(client, "confirm", (states) => states.length);
    expect(stack()).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toBe(1);
  });

  it("useLayer returns the matching layer state or null", () => {
    const client = new LayerClient();
    const layer = useLayer(client, ["a"], "confirm");
    expect(layer()).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer()?.payload).toBe(1);
    expect(layer()?.key).toEqual(["a"]);
  });

  it("cleans up the subscription on context destroy", () => {
    const client = new LayerClient();
    useStack(client, "confirm");
    expect(client.getStack("confirm").size).toBe(1);
    runCleanups();
    expect(client.getStack("confirm").size).toBe(0);
  });

  it("without client resolves from DI and mirrors the stack", () => {
    const client = new LayerClient();
    injectionRegistry.set(LAYER_CLIENT, client);
    const stack = useStack("confirm");
    expect(stack()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toHaveLength(1);
    expect(stack()[0]?.payload).toBe(1);
  });

  it("useLayer without client resolves from DI", () => {
    const client = new LayerClient();
    injectionRegistry.set(LAYER_CLIENT, client);
    const layer = useLayer(["a"], "confirm");
    expect(layer()).toBeNull();
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer()?.payload).toBe(1);
    expect(layer()?.key).toEqual(["a"]);
  });
});

describe("provideLayerClient (angular)", () => {
  it("defines LAYER_CLIENT injection token", () => {
    expect(LAYER_CLIENT).toBeDefined();
  });

  it("returns a provider for LAYER_CLIENT whose factory yields the given client", () => {
    const client = new LayerClient();
    const provider = provideLayerClient(client);
    expect(provider.provide).toBe(LAYER_CLIENT);
    expect(provider.useFactory?.()).toBe(client);
  });

  it("factory creates a new LayerClient when client is omitted", () => {
    const provider = provideLayerClient();
    const created = provider.useFactory?.();
    expect(created).toBeInstanceOf(LayerClient);
  });

  it("useLayerClient injects the registered client", () => {
    const client = new LayerClient();
    injectionRegistry.set(LAYER_CLIENT, client);
    expect(useLayerClient()).toBe(client);
  });
});
