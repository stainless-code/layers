import { layerKey } from "@stainless-code/layers";
import type {
  LayerCallContext,
  LayerState,
  StandardSchemaV1,
} from "@stainless-code/layers";
/**
 * Svelte runes adapter type-level inference tests. Compiled by `tsc --noEmit`
 * as part of the src program; never executed. Registered as a knip entry so its
 * exports are not flagged.
 */
import type { MutationFlow } from "@stainless-code/svelte-layers";
import {
  createLayer,
  createLayerState,
  layerOptions,
  useLayerGroup,
  useMutationFlow,
  useStack,
} from "@stainless-code/svelte-layers";

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
  Equal<MutationFlow<boolean>["pending"], boolean>
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
  Equal<ReturnType<typeof useStackDefault>["current"], LayerState[]>
>;
function useStackWithSelect() {
  return useStack({ stack: "s", select: nSelector });
}
export type _UseStackSelectorFlows = Expect<
  Equal<ReturnType<typeof useStackWithSelect>["current"], { n: number }>
>;

function useLayerStateTagged() {
  return createLayerState({ key: removeKey });
}
type _SvelteCreateLayerStateTagged = ReturnType<typeof useLayerStateTagged>;
export type _CreateLayerStateInfersResponse = Expect<
  Equal<
    _SvelteCreateLayerStateTagged["current"],
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

const validatedConfirm = {
  key: ["v"],
  validate: idSchema,
};

function useValidatedLayer() {
  return createLayer(validatedConfirm);
}
export type _ValidatedCreateLayerOpenAcceptsInput = Expect<
  Equal<
    Parameters<ReturnType<typeof useValidatedLayer>["open"]>[0],
    { id: string }
  >
>;
export type _ValidatedCreateLayerStatePayload = Expect<
  Equal<
    ReturnType<typeof useValidatedLayer>["state"][number]["payload"],
    { id: number }
  >
>;

const voidOpts = layerOptions<void, boolean>({ key: ["void"] });
function useVoidLayer() {
  return createLayer(voidOpts);
}
function openVoidCreateLayerOmitted() {
  return useVoidLayer().open();
}
void openVoidCreateLayerOmitted;
