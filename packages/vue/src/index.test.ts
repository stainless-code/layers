import { describe, expect, it } from "bun:test";

import { LayerClient } from "@stainless-code/layers";
// Note: `vue` is NOT mocked here — `useStack` relies on real `shallowRef` /
// `effectScope` reactivity. `provide`/`inject` need a component instance (not
// available under bun), so the context suite below tests the wrapper contract
// (return value + missing-provider throw) rather than a full inject round-trip.
import { effect, effectScope } from "vue";

import {
  provideLayerClient,
  useLayerClient,
  useLayerState,
  useStack,
} from "./index";

describe("useStack (vue)", () => {
  it("returns a ref that mirrors the stack and updates reactively", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack({ stack: "confirm" }, client);
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

  it("with a select returns the selected slice", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack(
        { stack: "confirm", select: (states) => states.length },
        client,
      );
      expect(stack.value).toBe(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      expect(stack.value).toBe(1);
    });
    scope.stop();
  });

  it("useLayerState returns matching layer states as an array", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const layer = useLayerState({ key: ["a"], stack: "confirm" }, client);
      expect(layer.value).toHaveLength(0);
      client.open({ key: ["a"], payload: 1, stack: "confirm" });
      expect(layer.value).toHaveLength(1);
      expect(layer.value[0]?.payload).toBe(1);
      expect(layer.value[0]?.key).toEqual(["a"]);
    });
    scope.stop();
  });

  it("cleans up the subscription on scope.stop()", () => {
    const client = new LayerClient();
    const scope = effectScope();
    scope.run(() => {
      const stack = useStack({ stack: "confirm" }, client);
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
