import type { DefaultLayerError, LayerKey } from "./types";

declare const dataTagSymbol: unique symbol;
declare const dataTagErrorSymbol: unique symbol;

/**
 * Phantom-brands a {@link LayerKey} so response and error types survive inference
 * without runtime metadata.
 * Tagging is idempotent: the first tag wins, avoiding conflicting brands
 * intersecting into `never`.
 */
export type DataTag<
  Key extends LayerKey,
  R,
  E = DefaultLayerError,
> = Key extends { [dataTagSymbol]: unknown; [dataTagErrorSymbol]: unknown }
  ? Key
  : Key & {
      [dataTagSymbol]: R;
      [dataTagErrorSymbol]: E;
    };

/** Lets generic APIs recover the response associated with a tagged key. */
export type InferDataTagResponse<Key> = Key extends {
  [dataTagSymbol]: infer R;
}
  ? R
  : never;

/** Lets generic APIs recover the error associated with a tagged key. */
export type InferDataTagError<Key> = Key extends {
  [dataTagErrorSymbol]: infer E;
}
  ? E
  : never;

/**
 * Preserves a response default when a generic key is untagged.
 */
export type ResponseOf<Key, Fallback = void> = Key extends {
  [dataTagSymbol]: infer R;
}
  ? R
  : Fallback;

/** Preserves an error default when a generic key is untagged. */
export type ErrorOf<Key, Fallback = DefaultLayerError> = Key extends {
  [dataTagErrorSymbol]: infer E;
}
  ? E
  : Fallback;

/**
 * Adds response and error inference to a key without changing it at runtime.
 *
 * @example
 * ```ts
 * import { LayerClient, layerKey } from "@stainless-code/layers";
 *
 * const client = new LayerClient();
 * const removeKey = layerKey<boolean>()(["confirm", "remove"]);
 * const ok = await client.open({ key: removeKey, payload: { title: "Remove?" } });
 * //    ^? boolean
 * ```
 */
export function layerKey<R, E = DefaultLayerError>() {
  return <const Key extends LayerKey>(key: Key): DataTag<Key, R, E> =>
    key as DataTag<Key, R, E>;
}
