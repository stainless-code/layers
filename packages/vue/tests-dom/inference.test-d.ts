import { LayerClient, layerKey } from "@stainless-code/layers";
import type { LayerCallContext, LayerState } from "@stainless-code/layers";
/**
 * Vue adapter type-level inference tests. Compiled by `tsc --noEmit`
 * (tsconfig includes `tests-dom/**`); never executed — vitest's
 * `*.test.{ts,tsx}` glob skips `*.test-d.ts`.
 * Registered as a knip entry so its exports are not flagged.
 */
import type {
  AppLayerProps,
  AppStack,
  MutationFlow,
  StackSubscribeProps,
} from "@stainless-code/vue-layers";
import {
  createStackHook,
  useLayer as useVueLayer,
  useLayerGroup,
  useMutationFlow,
  useStack,
} from "@stainless-code/vue-layers";
import type { Ref } from "vue";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

declare const client: LayerClient;

const removeKey = layerKey<boolean>()(["confirm", "remove"]);

declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;

// M1 — `useStack` selector return flows through; default is `LayerState[]`.
function useStackDefault() {
  return useStack("s");
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<ReturnType<typeof useStackDefault>["value"], LayerState[]>
>;
function useStackWithSelector() {
  return useStack("s", nSelector);
}
export type _UseStackSelectorFlows = Expect<
  Equal<ReturnType<typeof useStackWithSelector>["value"], { n: number }>
>;
function useStackExplicitGeneric() {
  return useStack<_NSelectorReturn>("s", nSelector);
}
export type _UseStackSelectorFromDecl = Expect<
  Equal<ReturnType<typeof useStackExplicitGeneric>["value"], { n: number }>
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
type _VueUseLayerTagged = ReturnType<
  typeof useVueLayer<typeof removeKey>
>["value"];
export type _UseLayerInfersResponse = Expect<
  Equal<_VueUseLayerTagged, LayerState<unknown, boolean, Error, unknown> | null>
>;
type _VueUseLayerPlain = ReturnType<typeof useVueLayer<["plain"]>>["value"];
export type _UseLayerPlainVoid = Expect<
  Equal<_VueUseLayerPlain, LayerState<unknown, void, Error, unknown> | null>
>;

// `StackSubscribeProps` threads the selector return type through `T` (the
// slot payload itself is `{ value: unknown }` — Vue can't thread the generic
// into a stateful component's slot; prefer `useStack` for a typed value).
export type _StackSubscribePropsSelector = Expect<
  Equal<
    StackSubscribeProps<{ n: number }>["selector"],
    (states: LayerState[]) => { n: number }
  >
>;

declare const call: LayerCallContext<unknown, boolean>;
declare const flow: MutationFlow<boolean>;
export type _MutationFlowPending = Expect<
  Equal<(typeof flow)["pending"], Readonly<Ref<boolean>>>
>;
export type _MutationFlowRun = Expect<
  Equal<
    ReturnType<(typeof flow)["run"]>["orEnd"],
    (response: boolean) => Promise<void>
  >
>;
void useMutationFlow(call);

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

declare const group: ReturnType<typeof useLayerGroup>;
declare const groupOpen: (typeof group)["open"];
function openGroupTagged() {
  return groupOpen({ key: removeKey, payload: { title: "Remove?" } });
}
export type _LayerGroupOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openGroupTagged>>, boolean>
>;

declare const _appHook: ReturnType<typeof createStackHook>;
// `AppLayerProps<P, R>` threads the payload `P` and response `R` through.
type _AppLayerP = AppLayerProps<{ title: string }, boolean>;
export type _AppLayerPropsOpen = Expect<Equal<_AppLayerP["open"], boolean>>;
export type _AppLayerPropsPayload = Expect<
  Equal<_AppLayerP["payload"], { title: string }>
>;
export type _AppLayerPropsOnResolved = Expect<
  Equal<_AppLayerP["onResolved"], ((response: boolean) => void) | undefined>
>;

void client;
void _appHook;
void group;
