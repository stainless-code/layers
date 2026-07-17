import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  createCallContext,
  LayerClient,
  layerOptions,
} from "@stainless-code/layers";
import type { LayerState } from "@stainless-code/layers";

import {
  createLayer,
  createStackHook,
  getLayerClient,
  setLayerClient,
  useLayerGroup,
  useMutationFlow,
  useStack,
} from "./index";
import { __resetLayerClientForTests } from "./layer-client";

const originalWarn = console.warn;

beforeEach(() => {
  __resetLayerClientForTests();
  // Unit suite runs without Alpine.plugin — alpineReactive's one-shot warn is expected.
  console.warn = () => {};
});

afterEach(() => {
  console.warn = originalWarn;
});

describe("getLayerClient / setLayerClient", () => {
  it("lazy-creates a client on first getLayerClient()", () => {
    const a = getLayerClient();
    const b = getLayerClient();
    expect(a).toBeInstanceOf(LayerClient);
    expect(b).toBe(a);
  });

  it("setLayerClient before first use pins the client", () => {
    const client = new LayerClient();
    setLayerClient(client);
    expect(getLayerClient()).toBe(client);
  });

  it("setLayerClient throws after getLayerClient has run", () => {
    getLayerClient();
    expect(() => setLayerClient(new LayerClient())).toThrow(
      "[layers/alpine] setLayerClient()",
    );
  });
});

describe("useStack (alpine)", () => {
  it("current mirrors the stack snapshot and updates on open", () => {
    const client = new LayerClient();
    const stack = useStack({ stack: "confirm" }, client);
    expect(stack.current).toHaveLength(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
    expect(stack.current[0]?.payload).toBe(1);
  });

  it("destroy unsubscribes from the stack", () => {
    const client = new LayerClient();
    const stack = useStack({ stack: "confirm" }, client);
    expect(client.getStack("confirm").size).toBe(1);
    stack.destroy();
    expect(client.getStack("confirm").size).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(0);
  });

  it("callFor ends the layer", async () => {
    const client = new LayerClient();
    const stack = useStack({ stack: "confirm" }, client);
    const pending = client.open<number, boolean>({
      key: ["b"],
      payload: 2,
      stack: "confirm",
    });
    const call = stack.callFor(stack.current[0]!);
    expect(call).not.toBeNull();
    call!.end(true);
    expect(await pending).toBe(true);
  });
});

describe("createLayer (alpine)", () => {
  it("open resolves with the layer response", async () => {
    const client = new LayerClient();
    const opts = layerOptions<{ title: string }, boolean>({
      stack: "modal",
      key: ["confirm", "test"],
      exitingDelay: 0,
    });
    const handle = createLayer(opts, client);
    const pending = handle.open({ title: "Hi" });
    expect(handle.state).toHaveLength(1);
    const top = handle.top;
    expect(top?.payload).toEqual({ title: "Hi" });
    const obs = useStack({ stack: "modal" }, client);
    const call = obs.callFor(top! as LayerState);
    call!.end(false);
    obs.destroy();
    expect(await pending).toBe(false);
  });
});

describe("useMutationFlow (alpine)", () => {
  it("orEnd ends the layer after the action succeeds", async () => {
    const client = new LayerClient();
    const pending = client.open<void, string>({
      key: ["m"],
      payload: undefined,
      stack: "confirm",
      exitingDelay: 0,
    });
    const stack = client.getStack("confirm");
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(
      stack as never,
      stack.getLayer(state.id)! as never,
      state as never,
    );
    const flow = useMutationFlow(call);
    expect(flow.pending).toBe(false);
    await flow.run(async () => {}).orEnd("ok");
    expect(await pending).toBe("ok");
  });
});

describe("useLayerGroup (alpine)", () => {
  it("opens on a child stackId and dispose tears down", async () => {
    const client = new LayerClient();
    const parentPending = client.open<void, boolean>({
      key: ["parent"],
      payload: undefined,
      stack: "confirm",
      exitingDelay: 0,
    });
    const parentStack = client.getStack("confirm");
    const parentState = parentStack.getSnapshot()[0]!;
    const call = createCallContext(
      parentStack as never,
      parentStack.getLayer(parentState.id)! as never,
      parentState as never,
    );
    const group = useLayerGroup(call, { name: "child" }, client);
    expect(group.stackId).toContain(parentState.id);
    const childPending = group.open<number, boolean>({
      key: ["c"],
      payload: 1,
      exitingDelay: 0,
    });
    expect(group.states.current).toHaveLength(1);
    const childState = group.states.current[0]!;
    const childStack = client.getStack(group.stackId);
    createCallContext(
      childStack as never,
      childStack.getLayer(childState.id)! as never,
      childState as never,
    ).end(true);
    expect(await childPending).toBe(true);
    group.dispose();
    expect(client.getStack(group.stackId).getSnapshot()).toHaveLength(0);
    call.end(false);
    expect(await parentPending).toBe(false);
  });
});

describe("createStackHook (alpine)", () => {
  it("setClient pins and useAppStack opens the bound stack", async () => {
    const client = new LayerClient();
    const hook = createStackHook({ client, stack: "app" });
    const app = hook.useAppStack();
    const pending = app.open<number, boolean>({
      key: ["x"],
      payload: 1,
      exitingDelay: 0,
    });
    expect(app.states.current).toHaveLength(1);
    const state = app.states.current[0]!;
    const stack = client.getStack("app");
    createCallContext(
      stack as never,
      stack.getLayer(state.id)! as never,
      state as never,
    ).end(true);
    expect(await pending).toBe(true);
    app.states.destroy();
  });
});
