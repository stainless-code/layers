import { beforeAll, describe, expect, it, mock } from "bun:test";

// Minimal Preact stubs — `useStack` only needs `useContext` (for the client),
// `useRef`/`useCallback` (stable fns), and `useSyncExternalStore` (compat).
// `h`/`Fragment`/`createContext` are stubbed as inert values since the test
// never renders an outlet.
let currentClient: { open: (...a: never[]) => unknown } | null = null;

mock.module("preact", () => ({
  createContext: () => ({ Provider: "Provider" }),
  useContext: () => currentClient,
  Fragment: "Fragment",
  h: (type: unknown, props: unknown, ...kids: unknown[]) => ({
    type,
    props,
    kids,
  }),
}));

mock.module("preact/hooks", () => ({
  useRef: (init: unknown) => ({ current: init }),
  useCallback: (fn: unknown) => fn,
  useState: (init: unknown) => [
    typeof init === "function" ? (init as () => unknown)() : init,
    () => {},
  ],
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
}));

mock.module("preact/compat", () => ({
  useContext: () => currentClient,
  useSyncExternalStore: (
    subscribe: (onChange: () => void) => () => void,
    getSnapshot: () => unknown,
  ) => {
    subscribe(() => {});
    return getSnapshot();
  },
}));

let useStack: typeof import("./index").useStack;
let LayerClient: typeof import("@stainless-code/layers").LayerClient;

beforeAll(async () => {
  ({ useStack } = await import("./index"));
  ({ LayerClient } = await import("@stainless-code/layers"));
});

describe("useStack (preact)", () => {
  it("returns the stack snapshot via useSyncExternalStore", () => {
    const client = new LayerClient();
    currentClient = client as never;
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    const states = useStack({ stack: "confirm" });
    expect(states).toHaveLength(1);
    expect(states[0]?.payload).toBe(1);
  });
});
