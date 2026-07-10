let isBatching = false;
const scheduled = new Set<() => void>();

/**
 * Coalesces listener calls by identity within a synchronous batch.
 * Nested batches flush only when the outer batch completes; wrapped listeners
 * called repeatedly during that interval run once.
 */
export const notifyManager = {
  batch<T>(fn: () => T): T {
    if (isBatching) {
      return fn();
    }
    isBatching = true;
    try {
      return fn();
    } finally {
      isBatching = false;
      for (const listener of scheduled) {
        listener();
      }
      scheduled.clear();
    }
  },

  batchCalls(listener: () => void): () => void {
    return () => {
      if (isBatching) {
        scheduled.add(listener);
      } else {
        listener();
      }
    };
  },
};
