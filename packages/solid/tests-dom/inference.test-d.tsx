import { LayerClient, layerKey } from "@stainless-code/layers";
import type { LayerCallContext, LayerState } from "@stainless-code/layers";
/**
 * Solid adapter type-level inference tests. Compiled by `tsc --noEmit`
 * (tsconfig includes `tests-dom/**` + `.tsx`); never executed — vitest's
 * `*.test.{ts,tsx}` glob skips `*.test-d.tsx`.
 * Registered as a knip entry so its exports are not flagged.
 */
import {
  useLayer as useSolidLayer,
  useStack,
  createStackHook,
  useLayerGroup,
  useMutationFlow,
} from "@stainless-code/solid-layers";
import type {
  AppLayerProps,
  AppStack,
  MutationFlow,
  StackHandles,
} from "@stainless-code/solid-layers";
import type { Accessor } from "solid-js";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

/** Peel `Accessor<T>` for Solid adapter return assertions. */
type UnwrapAccessor<A> = A extends Accessor<infer T> ? T : never;

declare const client: LayerClient;

const removeKey = layerKey<boolean>()(["confirm", "remove"]);

declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;

// M1 — `useStack` selector return flows through as `Accessor<T>`; default is `LayerState[]`.
function useStackDefault() {
  return useStack("s");
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<UnwrapAccessor<ReturnType<typeof useStackDefault>>, LayerState[]>
>;
export type _UseStackSelectorFlows = Expect<
  Equal<
    UnwrapAccessor<ReturnType<typeof useStack<{ n: number }>>>,
    { n: number }
  >
>;
export type _UseStackSelectorFromDecl = Expect<
  Equal<
    UnwrapAccessor<ReturnType<typeof useStack<_NSelectorReturn>>>,
    { n: number }
  >
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
type _SolidUseLayerTagged = ReturnType<typeof useSolidLayer<typeof removeKey>>;
export type _UseLayerInfersResponse = Expect<
  Equal<
    UnwrapAccessor<_SolidUseLayerTagged>,
    LayerState<unknown, boolean, Error, unknown> | null
  >
>;
type _SolidUseLayerPlain = ReturnType<typeof useSolidLayer<["plain"]>>;
export type _UseLayerPlainVoid = Expect<
  Equal<
    UnwrapAccessor<_SolidUseLayerPlain>,
    LayerState<unknown, void, Error, unknown> | null
  >
>;
export type _SolidUseLayerTaggedResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerTagged>>["response"],
    boolean | undefined
  >
>;
export type _SolidUseLayerPlainResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerPlain>>["response"],
    void | undefined
  >
>;

// `useStackHandles.states` is an `Accessor<LayerState[]>`.
declare const handles: StackHandles;
export type _StackHandlesStates = Expect<
  Equal<(typeof handles)["states"], Accessor<LayerState[]>>
>;

declare const call: LayerCallContext<unknown, boolean>;
declare const flow: MutationFlow<boolean>;
export type _MutationFlowPending = Expect<
  Equal<(typeof flow)["pending"], Accessor<boolean>>
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
