import type {
  LayerCallContext,
  LayerState,
  StandardSchemaV1,
} from "@stainless-code/layers";
import { LayerClient, layerKey, layerOptions } from "@stainless-code/layers";
/**
 * Solid adapter type-level inference tests. Compiled by `tsc --noEmit`
 * (tsconfig includes `tests-dom/**` + `.tsx`); never executed — vitest's
 * `*.test.{ts,tsx}` glob skips `*.test-d.tsx`.
 * Registered as a knip entry so its exports are not flagged.
 */
import {
  createStackHook,
  useLayer,
  useLayerState,
  useStack,
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

// M1 — `useStack` select return flows through as `Accessor<T>`; default is `LayerState[]`.
function useStackDefault() {
  return useStack({ stack: "s" });
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<UnwrapAccessor<ReturnType<typeof useStackDefault>>, LayerState[]>
>;
function useStackWithSelect() {
  return useStack<{ n: number }>({ stack: "s", select: nSelector });
}
export type _UseStackSelectorFlows = Expect<
  Equal<UnwrapAccessor<ReturnType<typeof useStackWithSelect>>, { n: number }>
>;
export type _UseStackSelectorFromDecl = Expect<
  Equal<
    UnwrapAccessor<ReturnType<typeof useStack<_NSelectorReturn>>>,
    { n: number }
  >
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
type _SolidUseLayerStateTagged = ReturnType<typeof useLayerStateTagged>;
export type _UseLayerStateInfersResponse = Expect<
  Equal<
    UnwrapAccessor<_SolidUseLayerStateTagged>,
    LayerState<unknown, boolean, Error, unknown>[]
  >
>;
function useLayerStatePlain() {
  return useLayerState({ key: ["plain"] as const });
}
type _SolidUseLayerStatePlain = ReturnType<typeof useLayerStatePlain>;
export type _UseLayerStatePlainVoid = Expect<
  Equal<
    UnwrapAccessor<_SolidUseLayerStatePlain>,
    LayerState<unknown, void, Error, unknown>[]
  >
>;
export type _SolidUseLayerStateTaggedResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerStateTagged>[number]>["response"],
    boolean | undefined
  >
>;
export type _SolidUseLayerStatePlainResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerStatePlain>[number]>["response"],
    void | undefined
  >
>;

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
    UnwrapAccessor<
      ReturnType<typeof useValidatedLayer>["state"]
    >[number]["payload"],
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
