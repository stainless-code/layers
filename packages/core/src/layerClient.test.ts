import { describe, expect, it } from "bun:test";

import { LayerClient } from "./layerClient";
import { LayerStack } from "./layerStack";

describe("LayerClient — loadFn", () => {
  it("forwards loadFn through open to the stack", async () => {
    const client = new LayerClient();
    client.open({
      key: ["d"],
      payload: { id: 1 },
      stack: "modal",
      loadFn: async () => "data",
    });
    const stack = client.getStack("modal") as unknown as LayerStack<
      { id: number },
      void,
      Error,
      string
    >;
    expect(stack.getSnapshot()[0]?.phase).toBe("pending");
    await Promise.resolve();
    await Promise.resolve();
    expect(stack.getSnapshot()[0]?.phase).toBe("active");
    expect(stack.getSnapshot()[0]?.data).toBe("data");
  });
});

describe("LayerClient — stack enumeration", () => {
  it("getStackIds lists all materialized stacks", () => {
    const client = new LayerClient();
    client.open({ key: ["a"], payload: 1, stack: "modal" });
    client.open({ key: ["b"], payload: 2, stack: "toast" });
    const ids = client.getStackIds();
    expect(ids).toContain("modal");
    expect(ids).toContain("toast");
    expect(ids).toHaveLength(2);
  });
});

describe("LayerClient — subscribeStacks", () => {
  it("notifies on first materialization only; unsubscribe stops calls", () => {
    const client = new LayerClient();
    const seen: string[] = [];
    const unsubscribe = client.subscribeStacks((stackId) => {
      seen.push(stackId);
    });

    client.open({ key: ["a"], payload: 1, stack: "new-stack" });
    expect(seen).toEqual(["new-stack"]);

    client.open({ key: ["b"], payload: 2, stack: "new-stack" });
    expect(seen).toEqual(["new-stack"]);

    unsubscribe();
    client.open({ key: ["c"], payload: 3, stack: "another-stack" });
    expect(seen).toEqual(["new-stack"]);
  });
});
