import type { DataTag } from "./dataTag";
import type { DefaultLayerError, LayerKey, LayerOptions } from "./types";

/**
 * Preserves payload, response, error, and data inference for reusable layer options.
 * Returns the same object at runtime; its {@link DataTag}-branded key lets
 * `LayerClient.open` infer the response without an explicit generic.
 *
 * @example
 * ```ts
 * import { LayerClient, layerOptions } from "@stainless-code/layers";
 *
 * const client = new LayerClient();
 * const confirm = layerOptions<{ title: string }, boolean>({
 *   key: ["confirm", "remove"],
 * });
 * const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
 * //    ^? boolean
 * ```
 */
export function layerOptions<
  P,
  R = void,
  E = DefaultLayerError,
  D = unknown,
  RootProps = unknown,
  const Key extends LayerKey = LayerKey,
>(
  options: LayerOptions<P, R, E, D, RootProps> & { key: Key },
): LayerOptions<P, R, E, D, RootProps> & { key: DataTag<Key, R, E> } {
  return options as LayerOptions<P, R, E, D, RootProps> & {
    key: DataTag<Key, R, E>;
  };
}
