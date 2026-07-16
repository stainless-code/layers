import type { LayerState, StandardSchemaV1 } from "@stainless-code/layers";
import { LayerClient, layerKey, layerOptions } from "@stainless-code/layers";
/**
 * Preact adapter type-level inference tests. Compiled by `tsc --noEmit`
 * (tsconfig includes `tests-dom/**` + `.tsx`); never executed — vitest's
 * `*.test.{ts,tsx}` glob and bun's `*.test.ts` glob both skip `*.test-d.tsx`.
 * Registered as a knip entry so its exports are not flagged.
 */
import {
  createStackHook,
  useLayer,
  useLayerState,
  useStack,
} from "@stainless-code/preact-layers";
import type { AppStack } from "@stainless-code/preact-layers";

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

// M1 — `useStack` select return flows through; default is `LayerState[]`.
declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;
function useStackDefault() {
  return useStack({ stack: "s" });
}
export type _UseStackDefaultLayerStates = Expect<
  Equal<ReturnType<typeof useStackDefault>, LayerState[]>
>;
function useStackWithSelect() {
  return useStack<{ n: number }>({ stack: "s", select: nSelector });
}
export type _UseStackSelectorFlows = Expect<
  Equal<ReturnType<typeof useStackWithSelect>, { n: number }>
>;
export type _UseStackSelectorFromDecl = Expect<
  Equal<ReturnType<typeof useStack<_NSelectorReturn>>, { n: number }>
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
type _PreactUseLayerStateTagged = ReturnType<typeof useLayerStateTagged>;
export type _UseLayerStateInfersResponse = Expect<
  Equal<
    _PreactUseLayerStateTagged,
    LayerState<unknown, boolean, Error, unknown>[]
  >
>;
function useLayerStatePlain() {
  return useLayerState({ key: ["plain"] as const });
}
type _PreactUseLayerStatePlain = ReturnType<typeof useLayerStatePlain>;
export type _UseLayerStatePlainVoid = Expect<
  Equal<_PreactUseLayerStatePlain, LayerState<unknown, void, Error, unknown>[]>
>;
export type _PreactUseLayerStateTaggedResponse = Expect<
  Equal<
    NonNullable<_PreactUseLayerStateTagged[number]>["response"],
    boolean | undefined
  >
>;
export type _PreactUseLayerStatePlainResponse = Expect<
  Equal<
    NonNullable<_PreactUseLayerStatePlain[number]>["response"],
    void | undefined
  >
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
    ReturnType<typeof useValidatedLayer>["state"][number]["payload"],
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
