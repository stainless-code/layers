/**
 * Angular adapter type-level inference tests. Compiled by `tsc --noEmit`;
 * never executed — bun's `*.test.ts` glob skips `*.test-d.ts`. Registered as a
 * knip entry so its exports are not flagged.
 */
import type { Signal } from "@angular/core";
import { layerKey } from "@stainless-code/layers";
import type { LayerCallContext, LayerState } from "@stainless-code/layers";

import { createStackHook, useMutationFlow, useStackHandles } from "./index";
import type { AppStack, LayerGroup, MutationFlow, StackHandles } from "./index";

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
