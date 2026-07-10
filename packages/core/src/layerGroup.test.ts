import { describe, expect, it } from "bun:test";

import { LayerClient } from "./layerClient";
import { childStackId, createLayerGroup } from "./layerGroup";
import { LayerStack } from "./layerStack";

describe("childStackId", () => {
  it("derives a collision-free id with default name", () => {
    expect(childStackId({ stackId: "drawer", layerId: "L0#1" })).toBe(
      "drawer~L0#1~group",
    );
  });

  it("uses a custom name segment for sibling groups", () => {
    expect(
      childStackId({ stackId: "drawer", layerId: "L0#1" }, "actions"),
    ).toBe("drawer~L0#1~actions");
  });
});

describe("createLayerGroup — cascade", () => {
  it("drains the child stack when the parent layer is dismissed", async () => {
    const client = new LayerClient();
    const parentPending = client.open({
      key: ["parent"],
      payload: { title: "Parent" },
      stack: "drawer",
    });
    const drawer = client.getStack("drawer") as unknown as LayerStack<
      { title: string },
      boolean
    >;
    const parentLayer = drawer.find(["parent"])!;
    const parent = { stackId: drawer.id, layerId: parentLayer.id };

    const group = createLayerGroup(client, parent);
    const childPending = group.open({
      key: ["child"],
      payload: { label: "Child" },
    });
    const childStack = client.getStack(group.stackId);
    expect(childStack.getSnapshot()).toHaveLength(1);

    await drawer.dismiss(parentLayer, false);
    expect(childStack.getSnapshot()).toHaveLength(0);
    expect(await childPending).toBe(undefined);
    void parentPending;
  });
});

describe("createLayerGroup — nesting", () => {
  it("drains grandchild stacks when the top parent is dismissed", async () => {
    const client = new LayerClient();
    client.open({
      key: ["parent"],
      payload: { title: "Parent" },
      stack: "drawer",
    });
    const drawer = client.getStack("drawer") as unknown as LayerStack<
      { title: string },
      boolean
    >;
    const parentLayer = drawer.find(["parent"])!;
    const parent = { stackId: drawer.id, layerId: parentLayer.id };

    const group = createLayerGroup(client, parent);
    const childPending = group.open({
      key: ["child"],
      payload: { label: "Child" },
    });
    const childStack = client.getStack(group.stackId);
    const childLayer = childStack.find(["child"])!;
    const childParent = { stackId: group.stackId, layerId: childLayer.id };

    const grandchildGroup = createLayerGroup(client, childParent);
    const grandchildPending = grandchildGroup.open({
      key: ["grandchild"],
      payload: { label: "Grandchild" },
    });
    const grandchildStack = client.getStack(grandchildGroup.stackId);
    expect(childStack.getSnapshot()).toHaveLength(1);
    expect(grandchildStack.getSnapshot()).toHaveLength(1);

    await drawer.dismiss(parentLayer, false);
    expect(childStack.getSnapshot()).toHaveLength(0);
    expect(grandchildStack.getSnapshot()).toHaveLength(0);
    expect(await childPending).toBe(undefined);
    expect(await grandchildPending).toBe(undefined);
  });
});

describe("createLayerGroup — dispose", () => {
  it("does not drain the child stack after dispose unbinds the parent", async () => {
    const client = new LayerClient();
    client.open({
      key: ["parent"],
      payload: { title: "Parent" },
      stack: "drawer",
    });
    const drawer = client.getStack("drawer") as unknown as LayerStack<
      { title: string },
      boolean
    >;
    const parentLayer = drawer.find(["parent"])!;
    const parent = { stackId: drawer.id, layerId: parentLayer.id };

    const group = createLayerGroup(client, parent);
    const childPending = group.open({
      key: ["child"],
      payload: { label: "Child" },
    });
    const childStack = client.getStack(group.stackId);
    expect(childStack.getSnapshot()).toHaveLength(1);

    group.dispose();
    drawer.dismiss(parentLayer, false);
    expect(childStack.getSnapshot()).toHaveLength(1);
    void childPending;
  });
});
