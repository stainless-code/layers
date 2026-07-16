import { layerKey } from "@stainless-code/layers";
import type {
  LayerCallContext,
  LayerState,
  StandardSchemaV1,
} from "@stainless-code/layers";
/**
 * Svelte store adapter type-level inference tests. Compiled by `tsc --noEmit`
 * as part of the src program; never executed. Registered as a knip entry so its
 * exports are not flagged.
 */
import type { MutationFlow } from "@stainless-code/svelte-layers/store";
import {
  createLayer,
  createLayerState,
  useLayerGroup,
  useMutationFlow,
  useStack,
} from "@stainless-code/svelte-layers/store";
import type { Readable } from "svelte/store";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

const removeKey = layerKey<boolean>()(["confirm", "remove"]);

declare const call: LayerCallContext<void, boolean>;

function _useMutationFlowShape() {
  return useMutationFlow(call);
}
export type _UseMutationFlowShape = Expect<
  Equal<ReturnType<typeof _useMutationFlowShape>, MutationFlow<boolean>>
>;
export type _MutationFlowPending = Expect<
  Equal<MutationFlow<boolean>["pending"], Readable<boolean>>
>;
export type _MutationFlowRun = Expect<
  Equal<
    MutationFlow<boolean>["run"],
    (fn: () => Promise<void> | void) => {
      orEnd: (response: boolean) => Promise<void>;
    }
  >
>;
void useMutationFlow(call);

declare const group: ReturnType<typeof useLayerGroup>;
declare const groupOpen: (typeof group)["open"];
function openGroupTagged() {
  return groupOpen({ key: removeKey, payload: { title: "Remove?" } });
}
export type _LayerGroupOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openGroupTagged>>, boolean>
>;
void group;

declare const nSelector: (states: LayerState[]) => { n: number };
function useStackDefault() {
  return useStack({ stack: "s" });
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<
    ReturnType<typeof useStackDefault> extends Readable<infer T> ? T : never,
    LayerState[]
  >
>;

function createLayerStateTagged() {
  return createLayerState({ key: removeKey });
}
export type _StoreCreateLayerStateInfersResponse = Expect<
  Equal<
    ReturnType<typeof createLayerStateTagged> extends Readable<infer T>
      ? T
      : never,
    LayerState<unknown, boolean, Error, unknown>[]
  >
>;

const idSchema = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (v: unknown) => ({
      value: { id: Number((v as { id: string }).id) },
    }),
    types: undefined as unknown as {
      input: { id: string };
      output: { id: number };
    },
  },
} as StandardSchemaV1<{ id: string }, { id: number }>;

function useValidatedLayer() {
  return createLayer({ key: ["v"], validate: idSchema });
}
export type _StoreValidatedCreateLayerOpenAcceptsInput = Expect<
  Equal<
    Parameters<ReturnType<typeof useValidatedLayer>["open"]>[0],
    { id: string }
  >
>;
