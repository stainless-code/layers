import type { LayerState, StandardSchemaV1 } from "@stainless-code/layers";
import { LayerClient, layerKey, layerOptions } from "@stainless-code/layers";
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
  useLayer,
  useLayerGroup,
  useLayerState,
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

const confirmOpts = layerOptions<{ title: string }, boolean>({
  key: ["confirm", "count"],
});

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

declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;

// M1 — `useStack` select return flows through; default is `LayerState[]`.
function useStackDefault() {
  return useStack({ stack: "s" });
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<ReturnType<typeof useStackDefault>["value"], LayerState[]>
>;
function useStackWithSelect() {
  return useStack({ stack: "s", select: nSelector });
}
export type _UseStackSelectorFlows = Expect<
  Equal<ReturnType<typeof useStackWithSelect>["value"], { n: number }>
>;
function useStackExplicitGeneric() {
  return useStack<_NSelectorReturn>({ stack: "s", select: nSelector });
}
export type _UseStackSelectorFromDecl = Expect<
  Equal<ReturnType<typeof useStackExplicitGeneric>["value"], { n: number }>
>;
function useStackAcceptsCompare() {
  useStack({ stack: "s", select: nSelector, compare: (a, b) => a.n === b.n });
}
void useStackAcceptsCompare;
function useStackRejectsBadCompare() {
  // @ts-expect-error compare must return boolean
  useStack({ stack: "s", select: nSelector, compare: (_a, _b) => "bad" });
}
void useStackRejectsBadCompare;

// M4 — `useLayerState` honors a DataTag key: `R`/`E` inferred from the key alone.
function useLayerStateTagged() {
  return useLayerState({ key: removeKey });
}
type _VueUseLayerStateTagged = ReturnType<typeof useLayerStateTagged>["value"];
export type _UseLayerStateInfersResponse = Expect<
  Equal<_VueUseLayerStateTagged, LayerState<unknown, boolean, Error, unknown>[]>
>;
function useLayerStatePlain() {
  return useLayerState({ key: ["plain"] as const });
}
type _VueUseLayerStatePlain = ReturnType<typeof useLayerStatePlain>["value"];
export type _UseLayerStatePlainVoid = Expect<
  Equal<_VueUseLayerStatePlain, LayerState<unknown, void, Error, unknown>[]>
>;

// Wired `useLayer` — open infers `R` from layerOptions.
function useConfirmLayer() {
  return useLayer(confirmOpts);
}
function openViaUseLayer() {
  const c = useConfirmLayer();
  return c.open({ title: "n" });
}
export type _UseLayerOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaUseLayer>>, boolean>
>;

// Wired `useLayer` — validated: open accepts INPUT; state uses OUTPUT.
function useValidatedLayer() {
  return useLayer(validatedConfirm);
}
function openViaValidatedUseLayer() {
  const c = useValidatedLayer();
  return c.open({ id: "1" });
}
void openViaValidatedUseLayer;
export type _ValidatedUseLayerOpenAcceptsInput = Expect<
  Equal<
    Parameters<ReturnType<typeof useValidatedLayer>["open"]>[0],
    { id: string }
  >
>;
function openViaValidatedUseLayerWrongPayload() {
  const c = useValidatedLayer();
  // @ts-expect-error output shape is not the schema input
  return c.open({ id: 1 });
}
void openViaValidatedUseLayerWrongPayload;
export type _ValidatedUseLayerStatePayload = Expect<
  Equal<
    ReturnType<typeof useValidatedLayer>["state"]["value"][number]["payload"],
    { id: number }
  >
>;

// PayloadArg optionality on wired `useLayer`.
const voidOpts = layerOptions<void, boolean>({ key: ["void"] });
function useVoidLayer() {
  return useLayer(voidOpts);
}
function openVoidUseLayerOmitted() {
  return useVoidLayer().open();
}
void openVoidUseLayerOmitted;

const reqOpts = layerOptions<{ title: string }>({ key: ["req"] });
function openReqUseLayerOmitted() {
  // @ts-expect-error payload is required for a payload with required fields
  return useLayer(reqOpts).open();
}
void openReqUseLayerOmitted;

// `StackSubscribeProps` threads the selector return type through `T` (the
// slot payload itself is `{ value: unknown }` — Vue can't thread the generic
// into a stateful component's slot; prefer `useStack` for a typed value).
export type _StackSubscribePropsSelector = Expect<
  Equal<
    StackSubscribeProps<{ n: number }>["selector"],
    (states: LayerState[]) => { n: number }
  >
>;

declare const call: import("@stainless-code/layers").LayerCallContext<
  unknown,
  boolean
>;
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
