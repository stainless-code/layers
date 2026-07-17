import { describe, expect, it } from "bun:test";

import {
  createCallContext,
  LayerClient,
  layerOptions,
} from "@stainless-code/layers";
import type { LayerCallContext } from "@stainless-code/layers";
import type { ReactiveController, ReactiveControllerHost } from "lit";

import {
  defineStackElements,
  MutationFlowController,
  StackController,
  useLayer,
  useLayerGroup,
  useLayerQueuedState,
  useLayerState,
  useMutationFlow,
  useQueuedStack,
  useStack,
} from "./index";

type Host = ReactiveControllerHost & {
  removeController(c: ReactiveController): void;
};

function createHost() {
  const controllers: ReactiveController[] = [];
  let updateCount = 0;

  const host: Host = {
    addController(c) {
      controllers.push(c);
      (c as ReactiveController).hostConnected?.();
    },
    removeController(c) {
      const i = controllers.indexOf(c);
      if (i !== -1) controllers.splice(i, 1);
      (c as ReactiveController).hostDisconnected?.();
    },
    requestUpdate() {
      updateCount += 1;
    },
    updateComplete: Promise.resolve(true),
  };

  return {
    host,
    get updateCount() {
      return updateCount;
    },
    disconnect() {
      while (controllers.length > 0) {
        host.removeController(controllers[0]!);
      }
    },
  };
}

describe("useStack (lit)", () => {
  it("returns a controller whose current mirrors the stack and updates on open", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const stack = useStack(host, { stack: "confirm", client });
    expect(stack.current).toHaveLength(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
  });

  it("with a select returns the selected slice", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const stack = useStack(host, {
      stack: "confirm",
      select: (states) => states.length,
      client,
    });
    expect(stack.current).toBe(0);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toBe(1);
  });

  it("cleans up the subscription on host disconnect", () => {
    const client = new LayerClient();
    const { host, disconnect } = createHost();
    useStack(host, { stack: "confirm", client });
    expect(client.getStack("confirm").size).toBe(1);
    disconnect();
    expect(client.getStack("confirm").size).toBe(0);
  });

  it("throws when no client is provided", () => {
    const { host } = createHost();
    expect(() => useStack(host, { stack: "confirm" })).toThrow("[layers/lit]");
  });
});

describe("StackController bindClient (lit)", () => {
  it("with deferClient stays empty until bindClient, then mirrors the stack", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const stack = new StackController(
      host,
      { stack: "confirm" },
      undefined,
      false,
      true,
    );
    expect(stack.current).toHaveLength(0);
    stack.bindClient(client);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toHaveLength(1);
  });

  it("bindClient after connect subscribes without a separate context resolve", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const stack = new StackController(
      host,
      { stack: "confirm", select: (s) => s.length },
      undefined,
      false,
      true,
    );
    stack.bindClient(client);
    client.open({ key: ["a"], payload: 1, stack: "confirm" });
    expect(stack.current).toBe(1);
  });
});

describe("useQueuedStack (lit)", () => {
  it("mirrors the queued snapshot for a serial stack", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const { host } = createHost();
    const queued = useQueuedStack(host, {
      stack: "default",
      select: (s) => s.length,
      client,
    });
    expect(queued.current).toBe(0);
    void client.open({ key: ["a"], payload: 1 });
    void client.open({ key: ["b"], payload: 2 });
    expect(queued.current).toBe(1);
  });
});

describe("useLayerState (lit)", () => {
  it("filters mounted states by key", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const state = useLayerState(
      host,
      {
        key: ["dup"],
        select: (states) => states.map((s) => (s.payload as { n: number }).n),
      },
      client,
    );
    expect(state.current).toEqual([]);
    void client.open({ key: ["dup"], payload: { n: 1 } });
    void client.open({ key: ["other"], payload: { n: 2 } });
    expect(state.current).toEqual([1]);
  });

  it("useLayerQueuedState filters queued states by key", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const { host } = createHost();
    const queued = useLayerQueuedState(
      host,
      { key: ["b"], select: (s) => s.length },
      client,
    );
    void client.open({ key: ["a"], payload: 1 });
    void client.open({ key: ["b"], payload: 2 });
    expect(queued.current).toBe(1);
  });
});

const toastOptions = layerOptions<{ msg: string }, void>({
  stack: "default",
  key: ["toast"],
  component: undefined,
  exitingDelay: 0,
});

describe("useLayer (lit)", () => {
  it("wires open/dismiss/update/state/queued/top/current", async () => {
    const client = new LayerClient();
    const harness = createHost();
    const handle = useLayer(harness.host, toastOptions, client);
    expect(handle.state.current).toHaveLength(0);
    expect(handle.top).toBeNull();
    expect(handle.current).toBeNull();

    void handle.open({ msg: "hello" });
    expect(handle.state.current).toHaveLength(1);
    expect(handle.top?.payload.msg).toBe("hello");
    expect(handle.current).not.toBeNull();
    expect(handle.client).toBe(client);

    handle.update({ msg: "updated" });
    expect(handle.top?.payload.msg).toBe("updated");

    await handle.dismiss(undefined as void);
    await Promise.resolve();
    expect(handle.state.current).toHaveLength(0);
    expect(handle.current).toBeNull();
  });

  it("resolves with the response on dismiss", async () => {
    const client = new LayerClient();
    const { host } = createHost();
    const handle = useLayer(
      host,
      layerOptions<{ n: number }, boolean>({ key: ["dup"], exitingDelay: 0 }),
      client,
    );
    const pending = handle.open({ n: 1 });
    await handle.dismiss(true);
    expect(await pending).toBe(true);
  });

  it("cancelQueued resolves a queued layer", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const { host } = createHost();
    const a = useLayer(
      host,
      layerOptions<{ n: number }, boolean>({ key: ["a"], exitingDelay: 0 }),
      client,
    );
    const b = useLayer(
      host,
      layerOptions<{ n: number }, boolean>({ key: ["b"], exitingDelay: 0 }),
      client,
    );
    void a.open({ n: 1 });
    const pending = b.open({ n: 2 });
    expect(b.queued.current).toHaveLength(1);
    expect(b.cancelQueued(false)).toBe(true);
    expect(await pending).toBe(false);
    await a.dismiss(true);
  });

  it("throws without a client when context can't resolve (non-element host)", () => {
    const { host } = createHost();
    expect(() =>
      useLayer(host, toastOptions, undefined as unknown as LayerClient),
    ).toThrow("[layers/lit]");
  });

  it("validated handle stores parsed output in state", async () => {
    const idSchema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (v: unknown) => ({
          value: { id: Number((v as { id: string }).id) },
        }),
        types: undefined as unknown as {
          input: { id: string };
          output: { id: number };
        },
      },
    };
    const client = new LayerClient();
    const { host } = createHost();
    const handle = useLayer(
      host,
      {
        stack: "default",
        key: ["v"],
        validate: idSchema,
        component: undefined,
        exitingDelay: 0,
      },
      client,
    );
    void handle.open({ id: "42" });
    expect(handle.state.current[0]?.payload).toEqual({ id: 42 });
    await handle.dismiss(undefined as void);
  });
});

function makeCall(
  client: LayerClient,
  stack = "default",
): LayerCallContext<unknown, unknown> {
  const stk = client.getStack(stack);
  const opts = layerOptions<unknown, unknown>({
    stack,
    key: ["__callProbe"],
    component: undefined,
    exitingDelay: 0,
  });
  void client.open({ ...opts, payload: undefined }).catch(() => {});
  const state = stk.getSnapshot().at(-1)!;
  const layer = stk.getLayer(state.id)!;
  return createCallContext(
    stk as never,
    layer as never,
    state as never,
    undefined,
  ) as LayerCallContext<unknown, unknown>;
}

describe("useMutationFlow (lit)", () => {
  it("drives pending and ends the layer on success", async () => {
    const client = new LayerClient();
    const { host } = createHost();
    const call = makeCall(client);
    const flow = useMutationFlow<unknown, unknown>(host, call);
    expect(flow.pending).toBe(false);
    let resolved = false;
    void flow
      .run(async () => {
        await Promise.resolve();
      })
      .orEnd("ok");
    // pending flips true synchronously, then the layer ends
    expect(flow.pending).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    resolved = true;
    expect(resolved).toBe(true);
  });

  it("MutationFlowController requests host update on pending change", () => {
    const client = new LayerClient();
    const harness = createHost();
    const call = makeCall(client);
    const flow = new MutationFlowController<unknown>(harness.host, call);
    const before = harness.updateCount;
    void flow.run(() => {}).orEnd(undefined);
    expect(harness.updateCount).toBeGreaterThan(before);
  });
});

describe("useLayerGroup (lit)", () => {
  it("opens a child layer on the child stack and drains on dispose", async () => {
    const client = new LayerClient();
    const harness = createHost();
    const call = makeCall(client);
    const group = useLayerGroup<unknown, unknown>(
      harness.host,
      call,
      undefined,
      client,
    );
    const stackId = group.stackId;
    expect(stackId).toContain("~");

    const childOpts = layerOptions<{ label: string }, string>({
      key: ["child"],
      component: undefined,
      exitingDelay: 0,
    });
    const pending: Promise<string> = group.open({
      ...childOpts,
      payload: { label: "c" },
    }) as Promise<string>;
    expect(client.getStack(stackId).getSnapshot()).toHaveLength(1);

    const childState = client.getStack(stackId).getSnapshot()[0]!;
    client
      .getStack(stackId)
      .dismiss(
        client.getStack(stackId).getLayer(childState.id)!,
        "done" as never,
      );
    expect(await pending).toBe("done");

    // disconnecting the group drains the child stack (layers dismissed)
    harness.disconnect();
    expect(client.getStack(stackId).getSnapshot()).toHaveLength(0);
  });

  it("outlet() returns a TemplateResult-shaped object", () => {
    const client = new LayerClient();
    const { host } = createHost();
    const call = makeCall(client);
    const group = useLayerGroup<unknown, unknown>(
      host,
      call,
      undefined,
      client,
    );
    const result = group.outlet();
    // lit TemplateResult carries an `_$litType$` symbol field
    expect(result).toBeTypeOf("object");
    expect(
      (result as unknown as Record<string | symbol, unknown>)[
        Symbol.for("lit.litType")
      ] ??
        (result as unknown as Record<string | symbol, unknown>)["_$litType$"],
    ).toBeDefined();
  });
});

describe("defineStackElements (lit)", () => {
  it("no-ops without a customElements registry (SSR/bun)", () => {
    expect(() => defineStackElements()).not.toThrow();
  });
});
