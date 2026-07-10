import { describe, expect, it } from "bun:test";

import { createCallContext } from "./callContext";
import { LayerStack } from "./layerStack";

describe("createCallContext", () => {
  it("exposes stackId and layerId from the stack and layer", () => {
    const stack = new LayerStack<{ n: number }, void>("drawer");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(stack, layer, state);

    expect(call.stackId).toBe("drawer");
    expect(call.layerId).toBe(layer.id);
  });

  it("setRunning flips actionStatus via the stack snapshot", () => {
    const stack = new LayerStack<{ n: number }, void>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(stack, layer, state);

    call.setRunning(true);
    expect(stack.getSnapshot()[0]?.actionStatus).toBe("running");

    call.setRunning(false);
    expect(stack.getSnapshot()[0]?.actionStatus).toBe("idle");
  });

  it("settle exists and calls through to the stack", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({
      key: ["a"],
      payload: { n: 1 },
      enteringDelay: 50,
    });
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(stack, layer, state);

    expect(typeof call.settle).toBe("function");
    expect(stack.getSnapshot()[0]?.transition).toBe("entering");

    call.settle();
    expect(stack.getSnapshot()[0]?.transition).toBe("settled");
  });

  it("addBlocker exists and returns a disposer", () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(stack, layer, state);

    expect(typeof call.addBlocker).toBe("function");
    const dispose = call.addBlocker(() => false);
    expect(typeof dispose).toBe("function");
    expect(layer.blockers.size).toBe(1);
    dispose();
    expect(layer.blockers.size).toBe(0);
  });

  it("end and dismiss return a Promise<boolean>", async () => {
    const stack = new LayerStack<{ n: number }, boolean>("s");
    const layer = stack.open({ key: ["a"], payload: { n: 1 } });
    const state = stack.getSnapshot()[0]!;
    const call = createCallContext(stack, layer, state);

    const endResult = call.end(true);
    expect(endResult).toBeInstanceOf(Promise);
    expect(await endResult).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);

    const layer2 = stack.open({ key: ["b"], payload: { n: 2 } });
    const state2 = stack.getSnapshot()[0]!;
    const call2 = createCallContext(stack, layer2, state2);
    const dismissResult = call2.dismiss(false);
    expect(dismissResult).toBeInstanceOf(Promise);
    expect(await dismissResult).toBe(true);
    expect(stack.getSnapshot()).toHaveLength(0);
  });
});
