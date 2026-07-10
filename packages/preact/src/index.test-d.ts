import { LayerClient, layerKey, layerOptions } from "@stainless-code/layers";
import type { LayerCallContext, LayerState } from "@stainless-code/layers";
/**
 * Preact adapter type-level inference tests. Compiled by tsc --noEmit
 * (tsconfig includes src); never executed — bun's test glob skips test-d.ts.
 * Registered as a knip entry so its exports are not flagged.
 */
import {
  createStackHook,
  useLayer as usePreactLayer,
  useMutationFlow,
  useStack,
  useStackHandles,
} from "@stainless-code/preact-layers";
import type {
  AppStack,
  MutationFlow,
  StackHandles,
} from "@stainless-code/preact-layers";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

declare const client: LayerClient;

// A DataTag-branded key carries its response type end-to-end.
const removeKey = layerKey<boolean>()(["confirm", "remove"]);

// `layerOptions` auto-tags `key` with `DataTag` so `AppLayer` can infer `R`.
const autoTagged = layerOptions<{ title: string }, boolean>({
  key: ["confirm", "x"],
  component: undefined,
});

// `AppLayer` (declarative) infers `R` from `layerOptions`-built options — the
// phantom `_response` carries `R`, so `onResolved` receives it with no generic.
declare const _appHook: ReturnType<typeof createStackHook>;
function _appLayerInfersResponse() {
  _appHook.AppLayer({
    options: autoTagged, // layerOptions<{ title }, boolean>
    open: true,
    payload: { title: "x" },
    onResolved: (r) => {
      const response: boolean = r; // errors if `R` widened to `void`
      void response;
    },
  });
}
void _appLayerInfersResponse;
void client;

// M1 — `useStack` selector return flows through; default is `LayerState[]`.
declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;
function useStackDefault() {
  return useStack("s");
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<ReturnType<typeof useStackDefault>, LayerState[]>
>;
export type _UseStackSelectorFlows = Expect<
  Equal<ReturnType<typeof useStack<{ n: number }>>, { n: number }>
>;
export type _UseStackSelectorFromDecl = Expect<
  Equal<ReturnType<typeof useStack<_NSelectorReturn>>, { n: number }>
>;
function useStackAcceptsCompare() {
  useStack("s", nSelector, (a, b) => a.n === b.n);
}
void useStackAcceptsCompare;
function useStackRejectsBadCompare() {
  // @ts-expect-error compare must return boolean
  useStack("s", nSelector, (_a, _b) => "bad");
}
void useStackRejectsBadCompare;

// M4 — `useLayer` honors a DataTag key: `R`/`E` inferred from the key alone.
type _PreactUseLayerTagged = ReturnType<
  typeof usePreactLayer<typeof removeKey>
>;
export type _UseLayerInfersResponse = Expect<
  Equal<
    _PreactUseLayerTagged,
    LayerState<unknown, boolean, Error, unknown> | null
  >
>;
// A plain (untagged) key keeps the historical `R = void` default.
type _PreactUseLayerPlain = ReturnType<typeof usePreactLayer<["plain"]>>;
export type _UseLayerPlainVoid = Expect<
  Equal<_PreactUseLayerPlain, LayerState<unknown, void, Error, unknown> | null>
>;
export type _PreactUseLayerTaggedResponse = Expect<
  Equal<
    NonNullable<
      ReturnType<typeof usePreactLayer<typeof removeKey>>
    >["response"],
    boolean | undefined
  >
>;
export type _PreactUseLayerPlainResponse = Expect<
  Equal<
    NonNullable<ReturnType<typeof usePreactLayer<["plain"]>>>["response"],
    void | undefined
  >
>;

// M4 — scoped `open` (createStackHook/useLayerGroup) infers `R` from a DataTag key.
declare const appStack: AppStack;
function openScopedTagged() {
  return appStack.open({ key: removeKey, payload: { title: "Remove?" } });
}
export type _ScopedOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openScopedTagged>>, boolean>
>;
function openScopedPlain() {
  return appStack.open({ key: ["plain"], payload: { title: "hi" } });
}
export type _ScopedOpenPlainVoid = Expect<
  Equal<Awaited<ReturnType<typeof openScopedPlain>>, void>
>;

// Optional payload propagates through the scoped `open` wrapper: a void payload
// may be omitted; a required-field payload must still be provided.
function openScopedVoidOmitted() {
  return appStack.open<void>({ key: ["void"] });
}
void openScopedVoidOmitted;
function openScopedRequiredOmitted() {
  // @ts-expect-error payload with required fields must be provided
  return appStack.open<{ title: string }>({ key: ["req"] });
}
void openScopedRequiredOmitted;

// Tier 2 — `useStackHandles` exposes states + getCall with loose call context.
function _useStackHandlesShape() {
  return useStackHandles("default", {});
}
export type _UseStackHandlesShape = Expect<
  Equal<ReturnType<typeof _useStackHandlesShape>, StackHandles>
>;
export type _StackHandlesGetCall = Expect<
  Equal<
    StackHandles["getCall"],
    (state: LayerState) => LayerCallContext<unknown, unknown>
  >
>;

// Tier 2 — `useMutationFlow` exposes pending + run returning `MutationRun<R>`.
declare const call: LayerCallContext<void, boolean>;
function _useMutationFlowShape() {
  return useMutationFlow(call);
}
export type _UseMutationFlowShape = Expect<
  Equal<ReturnType<typeof _useMutationFlowShape>, MutationFlow<boolean>>
>;
export type _MutationFlowRun = Expect<
  Equal<
    MutationFlow<boolean>["run"],
    (fn: () => Promise<void> | void) => {
      orEnd: (response: boolean) => Promise<void>;
    }
  >
>;
