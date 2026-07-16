import { layerKey, layerOptions } from "@stainless-code/layers";
import { useLayer, useLayerState } from "@stainless-code/solid-layers";
/**
 * Solid adapter type-level inference tests. Compiled by `tsc --noEmit`;
 * never executed — bun's `*.test.ts` glob skips `*.test-d.ts`. Registered as a
 * knip entry so its exports are not flagged.
 */
import type { Accessor } from "solid-js";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

/** Peel `Accessor<T>` for Solid adapter return assertions. */
type UnwrapAccessor<A> = A extends Accessor<infer T> ? T : never;

// A DataTag-branded key carries its response type end-to-end.
const removeKey = layerKey<boolean>()(["confirm", "remove"]);

type _SolidUseLayerStateTagged = ReturnType<
  typeof useLayerState<typeof removeKey>
>;
export type _SolidUseLayerStateTaggedResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerStateTagged>[number]>["response"],
    boolean | undefined
  >
>;
type _SolidUseLayerStatePlain = ReturnType<typeof useLayerState<["plain"]>>;
export type _SolidUseLayerStatePlainResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerStatePlain>[number]>["response"],
    void | undefined
  >
>;

const confirmOpts = layerOptions<{ title: string }, boolean>({
  key: ["confirm", "count"],
});

function openViaUseLayer() {
  const c = useLayer(confirmOpts);
  return c.open({ title: "n" });
}
export type _UseLayerOpenInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaUseLayer>>, boolean>
>;
