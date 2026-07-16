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
  computed: <T>(fn: () => T) => {
    const sig = Object.assign(() => fn(), {
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

let injectLayer: typeof import("./index").injectLayer;
let injectLayerState: typeof import("./index").injectLayerState;
let injectQueuedStack: typeof import("./index").injectQueuedStack;
let injectLayerQueuedState: typeof import("./index").injectLayerQueuedState;
let injectStack: typeof import("./index").injectStack;
let useStack: typeof import("./index").useStack;
let LAYER_CLIENT: typeof import("./index").LAYER_CLIENT;
let provideLayerClient: typeof import("./index").provideLayerClient;
let useLayerClient: typeof import("./index").useLayerClient;
let LayerClient: typeof import("@stainless-code/layers").LayerClient;
let layerOptions: typeof import("@stainless-code/layers").layerOptions;

beforeAll(async () => {
  ({
    injectLayer,
    injectLayerState,
    injectQueuedStack,
    injectLayerQueuedState,
    injectStack,
    useStack,
    LAYER_CLIENT,
    provideLayerClient,
    useLayerClient,
  } = await import("./index"));
  ({ LayerClient, layerOptions } = await import("@stainless-code/layers"));
});

function runCleanups() {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
}

describe("useStack (angular)", () => {
  it("returns a signal that mirrors the stack", () => {
    const client = new LayerClient();
    const stack = useStack({ stack: "confirm" }, client);
    expect(stack()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toHaveLength(1);
    expect(stack()[0]?.payload).toBe(1);
  });

  it("with select returns the selected slice", () => {
    const client = new LayerClient();
    const stack = useStack(
      { stack: "confirm", select: (states) => states.length },
      client,
    );
    expect(stack()).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toBe(1);
  });

  it("injectStack is an alias of useStack", () => {
    const client = new LayerClient();
    const stack = injectStack({ stack: "confirm" }, client);
    expect(stack()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toHaveLength(1);
  });

  it("injectLayerState returns matching mounted layers as an array", () => {
    const client = new LayerClient();
    const layer = injectLayerState({ key: ["a"], stack: "confirm" }, client);
    expect(layer()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer()).toHaveLength(1);
    expect(layer()[0]?.payload).toBe(1);
    expect(layer()[0]?.key).toEqual(["a"]);
  });

  it("injectQueuedStack mirrors queued snapshot", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        confirm: { scope: { strategy: "serial" } },
      },
    });
    const queued = injectQueuedStack(
      { stack: "confirm", select: (s) => s.length },
      client,
    );
    expect(queued()).toBe(0);
    void client.open({ key: ["a"], payload: 1, stack: "confirm" });
    void client.open({ key: ["b"], payload: 2, stack: "confirm" });
    expect(queued()).toBe(1);
  });

  it("injectLayerQueuedState filters queued layers by key", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        confirm: { scope: { strategy: "serial" } },
      },
    });
    const queued = injectLayerQueuedState(
      { key: ["a"], stack: "confirm", select: (s) => s.length },
      client,
    );
    void client.open({ key: ["a"], payload: 1, stack: "confirm" });
    void client.open({ key: ["a"], payload: 2, stack: "confirm" });
    expect(queued()).toBe(1);
  });

  it("injectLayer wires createLayer with reactive state/queued/top", () => {
    const client = new LayerClient();
    const opts = layerOptions<{ n: number }, boolean>({
      key: ["wired"],
      stack: "confirm",
    });
    const handle = injectLayer(opts, client);
    expect(handle.state()).toEqual([]);
    expect(handle.queued()).toEqual([]);
    expect(handle.top()).toBeNull();
    expect(handle.current).toBeNull();
    void handle.open({ n: 1 });
    expect(handle.state()).toHaveLength(1);
    expect(handle.top()?.payload).toEqual({ n: 1 });
    expect(handle.current).not.toBeNull();
  });

  it("cleans up the subscription on context destroy", () => {
    const client = new LayerClient();
    useStack({ stack: "confirm" }, client);
    expect(client.getStack("confirm").size).toBe(1);
    runCleanups();
    expect(client.getStack("confirm").size).toBe(0);
  });

  it("without client resolves from DI and mirrors the stack", () => {
    const client = new LayerClient();
    injectionRegistry.set(LAYER_CLIENT, client);
    const stack = useStack({ stack: "confirm" });
    expect(stack()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack()).toHaveLength(1);
    expect(stack()[0]?.payload).toBe(1);
  });

  it("injectLayerState without client resolves from DI", () => {
    const client = new LayerClient();
    injectionRegistry.set(LAYER_CLIENT, client);
    const layer = injectLayerState({ key: ["a"], stack: "confirm" });
    expect(layer()).toEqual([]);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(layer()).toHaveLength(1);
    expect(layer()[0]?.payload).toBe(1);
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
