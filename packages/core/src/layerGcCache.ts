import type { Layer } from "./layer";
import type { LayerKey } from "./types";
import { keySignature } from "./utils";

export interface LayerGcCacheOptions<P, R, E, D> {
  /** Read at store time; `<= 0` disables caching. */
  gcTime: () => number;
  onBeforeStore?: (layer: Layer<P, R, E, D>) => void;
  /** Runs for expiry and same-key displacement, but not restoration. */
  onEvict?: (layer: Layer<P, R, E, D>) => void;
}

export interface LayerGcCache<P, R, E, D> {
  maybeStore(layer: Layer<P, R, E, D>): void;
  take(key: LayerKey): Layer<P, R, E, D> | undefined;
}

/**
 * Retains dismissed layer data for same-key restoration without reloading.
 * Only the last dismissed layer for each key is retained.
 */
export function createLayerGcCache<P, R, E, D>(
  opts: LayerGcCacheOptions<P, R, E, D>,
): LayerGcCache<P, R, E, D> {
  const entries = new Map<
    string,
    { layer: Layer<P, R, E, D>; timer: ReturnType<typeof setTimeout> }
  >();

  const evict = (sig: string): void => {
    const entry = entries.get(sig);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    entries.delete(sig);
    opts.onEvict?.(entry.layer);
  };

  return {
    maybeStore(layer) {
      const gcTime = opts.gcTime();
      if (gcTime <= 0 || layer.state.data === undefined) {
        return;
      }
      opts.onBeforeStore?.(layer);
      const sig = keySignature(layer.key);
      evict(sig);
      const timer = setTimeout(() => evict(sig), gcTime);
      entries.set(sig, { layer, timer });
    },
    take(key) {
      const sig = keySignature(key);
      const entry = entries.get(sig);
      if (!entry) {
        return undefined;
      }
      clearTimeout(entry.timer);
      entries.delete(sig);
      // Restoration transfers ownership without eviction cleanup.
      return entry.layer;
    },
  };
}
