import { layerKey } from "@stainless-code/layers";
import { useLayer as useSolidLayer } from "@stainless-code/solid-layers";
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

type _SolidUseLayerTagged = ReturnType<typeof useSolidLayer<typeof removeKey>>;
export type _SolidUseLayerTaggedResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerTagged>>["response"],
    boolean | undefined
  >
>;
type _SolidUseLayerPlain = ReturnType<typeof useSolidLayer<["plain"]>>;
export type _SolidUseLayerPlainResponse = Expect<
  Equal<
    NonNullable<UnwrapAccessor<_SolidUseLayerPlain>>["response"],
    void | undefined
  >
>;
