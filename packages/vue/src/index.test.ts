import { describe, expect, it } from "bun:test";

import { LayerClient } from "@stainless-code/layers";
// Note: `vue` is NOT mocked here — `useStack` relies on real `shallowRef` /
// `effectScope` reactivity. `provide`/`inject` need a component instance (not
// available under bun), so the context suite below tests the wrapper contract
// (return value + missing-provider throw) rather than a full inject round-trip.
import { effect, effectScope } from "vue";

import {
  provideLayerClient,
  useLayer,
  useLayerClient,
  useStack,
} from "./index";

describe("useStack (vue)", () => {
  it("returns a ref that mirrors the stack and updates reactively", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack(client, "confirm");
      let last: number | undefined;
      effect(() => {
        last = stack.value.length;
      });
      expect(last).toBe(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      expect(last).toBe(1);
    });
    scope.stop();
  });

  it("with a selector returns the selected slice", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack(client, "confirm", (states) => states.length);
      expect(stack.value).toBe(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      expect(stack.value).toBe(1);
    });
    scope.stop();
  });

  it("useLayer returns the matching layer state or null", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const layer = useLayer(client, ["a"], "confirm");
      expect(layer.value).toBeNull();
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      expect(layer.value?.payload).toBe(1);
      expect(layer.value?.key).toEqual(["a"]);
    });
    scope.stop();
  });

  it("cleans up the subscription on scope.stop()", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack(client, "confirm");
      effect(() => {
        void stack.value;
      });
    });
    expect(client.getStack("confirm").size).toBe(1);
    scope.stop();
    expect(client.getStack("confirm").size).toBe(0);
  });
});

describe("provideLayerClient / useLayerClient (vue)", () => {
  it("returns the given client, or creates one when omitted", () => {
    const client = new LayerClient();
    expect(provideLayerClient(client)).toBe(client);
    expect(provideLayerClient()).toBeInstanceOf(LayerClient);
  });

  it("throws when no client is provided", () => {
    expect(() => useLayerClient()).toThrow("[layers/vue]");
  });
});
