/**
 * Angular adapter type-level inference tests. Compiled by `tsc --noEmit`;
 * never executed — bun's `*.test.ts` glob skips `*.test-d.ts`. Registered as a
 * knip entry so its exports are not flagged.
 */
import type { Signal } from "@angular/core";
import { layerKey, layerOptions } from "@stainless-code/layers";
import type {
  LayerCallContext,
  LayerState,
  StandardSchemaV1,
} from "@stainless-code/layers";

import {
  createStackHook,
  injectLayer,
  injectLayerState,
  injectQueuedStack,
  injectStack,
  useMutationFlow,
  useStackHandles,
} from "./index";
import type {
  AppStack,
  LayerGroup,
  MutationFlow,
  StackHandles,
  WiredLayerHandle,
  WiredValidatedLayerHandle,
} from "./index";

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
  Equal<MutationFlow<boolean>["pending"], Signal<boolean>>
>;

function _useStackHandlesShape() {
  return useStackHandles("default", {});
}
export type _UseStackHandlesShape = Expect<
  Equal<ReturnType<typeof _useStackHandlesShape>, StackHandles>
>;
export type _StackHandlesStates = Expect<
  Equal<StackHandles["states"], Signal<LayerState[]>>
>;

declare const appStack: AppStack;
function openAppStackTagged() {
  return appStack.open({ key: removeKey, payload: { title: "Remove?" } });
}
export type _AppStackOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openAppStackTagged>>, boolean>
>;
function openAppStackPlain() {
  return appStack.open({ key: ["plain"], payload: { title: "hi" } });
}
export type _AppStackOpenPlainVoid = Expect<
  Equal<Awaited<ReturnType<typeof openAppStackPlain>>, void>
>;

declare const layerGroup: LayerGroup;
function openLayerGroupTagged() {
  return layerGroup.open({ key: removeKey, payload: { title: "Remove?" } });
}
export type _LayerGroupOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openLayerGroupTagged>>, boolean>
>;

declare const stackHook: ReturnType<typeof createStackHook>;
function openStackHookTagged() {
  return stackHook.useAppStack().open({
    key: removeKey,
    payload: { title: "Remove?" },
  });
}
export type _StackHookOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openStackHookTagged>>, boolean>
>;

// injectStack / useStack options bag
declare const nSelector: (states: LayerState[]) => { n: number };
type _NSelectorReturn = ReturnType<typeof nSelector>;
function injectStackDefault() {
  return injectStack({ stack: "s" });
}
export type _InjectStackDefaultLayerStates = Expect<
  Equal<ReturnType<typeof injectStackDefault>, Signal<LayerState[]>>
>;
function injectStackWithSelect() {
  return injectStack<{ n: number }>({ stack: "s", select: nSelector });
}
export type _InjectStackSelectorFlows = Expect<
  Equal<ReturnType<typeof injectStackWithSelect>, Signal<{ n: number }>>
>;
export type _InjectStackSelectorFromDecl = Expect<
  Equal<ReturnType<typeof injectStack<_NSelectorReturn>>, Signal<{ n: number }>>
>;
function injectStackAcceptsCompare() {
  injectStack({
    stack: "s",
    select: nSelector,
    compare: (a, b) => a.n === b.n,
  });
}
void injectStackAcceptsCompare;
function injectStackRejectsBadCompare() {
  // @ts-expect-error compare must return boolean
  injectStack({ stack: "s", select: nSelector, compare: (_a, _b) => "bad" });
}
void injectStackRejectsBadCompare;

// injectLayerState honors a DataTag key
function injectLayerStateTagged() {
  return injectLayerState({ key: removeKey });
}
type _AngularInjectLayerStateTagged = ReturnType<typeof injectLayerStateTagged>;
export type _InjectLayerStateInfersResponse = Expect<
  Equal<
    _AngularInjectLayerStateTagged,
    Signal<LayerState<unknown, boolean, Error, unknown>[]>
  >
>;
function injectLayerStatePlain() {
  return injectLayerState({ key: ["plain"] as const });
}
type _AngularInjectLayerStatePlain = ReturnType<typeof injectLayerStatePlain>;
export type _InjectLayerStatePlainVoid = Expect<
  Equal<
    _AngularInjectLayerStatePlain,
    Signal<LayerState<unknown, void, Error, unknown>[]>
  >
>;

// injectQueuedStack returns Signal
function injectQueuedStackDefault() {
  return injectQueuedStack({ stack: "s" });
}
export type _InjectQueuedStackDefault = Expect<
  Equal<ReturnType<typeof injectQueuedStackDefault>, Signal<LayerState[]>>
>;

// Wired injectLayer — open infers R from layerOptions
const confirmOpts = layerOptions<{ title: string }, boolean>({
  key: ["confirm", "count"],
});
function injectConfirmLayer() {
  return injectLayer(confirmOpts);
}
function openViaInjectLayer() {
  const c = injectConfirmLayer();
  return c.open({ title: "n" });
}
export type _InjectLayerOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaInjectLayer>>, boolean>
>;
export type _InjectLayerStateSignal = Expect<
  Equal<
    ReturnType<typeof injectConfirmLayer>["state"],
    Signal<LayerState<{ title: string }, boolean, Error, unknown>[]>
  >
>;
export type _InjectLayerTopSignal = Expect<
  Equal<
    ReturnType<typeof injectConfirmLayer>["top"],
    Signal<LayerState<{ title: string }, boolean, Error, unknown> | null>
  >
>;

// Validated injectLayer — open accepts INPUT; state uses OUTPUT
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

function injectValidatedLayer() {
  return injectLayer(validatedConfirm);
}
function openViaValidatedInjectLayer() {
  const c = injectValidatedLayer();
  return c.open({ id: "1" });
}
void openViaValidatedInjectLayer;
export type _ValidatedInjectLayerOpenAcceptsInput = Expect<
  Equal<
    Parameters<ReturnType<typeof injectValidatedLayer>["open"]>[0],
    { id: string }
  >
>;
function openViaValidatedInjectLayerWrongPayload() {
  const c = injectValidatedLayer();
  // @ts-expect-error output shape is not the schema input
  return c.open({ id: 1 });
}
void openViaValidatedInjectLayerWrongPayload;
export type _ValidatedInjectLayerStatePayload = Expect<
  Equal<
    ReturnType<typeof injectValidatedLayer>["state"] extends Signal<(infer S)[]>
      ? S extends { payload: infer P }
        ? P
        : never
      : never,
    { id: number }
  >
>;

// PayloadArg optionality on wired injectLayer
const voidOpts = layerOptions<void, boolean>({ key: ["void"] });
function injectVoidLayer() {
  return injectLayer(voidOpts);
}
function openVoidInjectLayerOmitted() {
  return injectVoidLayer().open();
}
void openVoidInjectLayerOmitted;

const reqOpts = layerOptions<{ title: string }>({ key: ["req"] });
function openReqInjectLayerOmitted() {
  // @ts-expect-error payload is required for a payload with required fields
  return injectLayer(reqOpts).open();
}
void openReqInjectLayerOmitted;

// Wired handle shape
declare const wired: WiredLayerHandle<{ title: string }, boolean>;
export type _WiredLayerHandleState = Expect<
  Equal<
    WiredLayerHandle<{ title: string }, boolean>["state"],
    Signal<LayerState<{ title: string }, boolean, Error, unknown>[]>
  >
>;
void wired;

declare const validatedWired: WiredValidatedLayerHandle<
  typeof idSchema,
  unknown
>;
export type _WiredValidatedLayerHandleState = Expect<
  Equal<
    WiredValidatedLayerHandle<typeof idSchema, unknown>["state"],
    Signal<LayerState<{ id: number }, unknown, Error, unknown>[]>
  >
>;
void validatedWired;
