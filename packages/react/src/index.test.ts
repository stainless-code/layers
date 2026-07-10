import { beforeAll, describe, expect, it, mock } from "bun:test";

// Minimal React stubs — `useStack` only needs `useContext` (for the client),
// `useRef`/`useCallback` (stable fns), and `useSyncExternalStore`.
// `createContext` is stubbed as an inert value since the test never renders.
let currentClient: { open: (...a: never[]) => unknown } | null = null;

mock.module("react", () => ({
  createContext: () => ({ Provider: "Provider" }),
  useContext: () => currentClient,
  useRef: (init: unknown) => ({ current: init }),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useMemo: (fn: () => unknown) => fn(),
  useState: (init: unknown) => [init, () => {}],
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

describe("useStack (react)", () => {
  it("returns the stack snapshot via useSyncExternalStore", () => {
    const client = new LayerClient();
    currentClient = client as never;
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    const states = useStack("confirm");
    expect(states).toHaveLength(1);
    expect(states[0]?.payload).toBe(1);
  });
});
