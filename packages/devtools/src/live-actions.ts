import type { DismissAllMode, LayerClient } from "@stainless-code/layers";

function resolveStack(client: LayerClient, stackId: string) {
  if (!client.getStackIds().includes(stackId)) {
    return undefined;
  }
  return client.getStack(stackId);
}

/** Soft-dismiss the top active layer (respects blockers). */
export function softDismissTop(
  client: LayerClient,
  stackId: string,
): Promise<boolean> | false {
  const stack = resolveStack(client, stackId);
  if (!stack) {
    return false;
  }
  const snapshot = stack.getSnapshot();
  const top = snapshot[snapshot.length - 1];
  if (!top) {
    return false;
  }
  const layer = stack.getLayer(top.id);
  if (!layer) {
    return false;
  }
  return stack.dismiss(layer, undefined);
}

/** Cancel the FIFO head of the serial queue (skips blockers). */
export function cancelQueuedHead(
  client: LayerClient,
  stackId: string,
): boolean {
  const stack = resolveStack(client, stackId);
  if (!stack) {
    return false;
  }
  const queued = stack.getQueuedSnapshot();
  const head = queued[0];
  if (!head) {
    return false;
  }
  return stack.cancelQueued(head.key, undefined, { id: head.id });
}

/** Force-dismiss the top active layer (bypasses blockers). */
export function forceDismissTop(
  client: LayerClient,
  stackId: string,
): Promise<boolean> | false {
  const stack = resolveStack(client, stackId);
  if (!stack) {
    return false;
  }
  const snapshot = stack.getSnapshot();
  const top = snapshot[snapshot.length - 1];
  if (!top) {
    return false;
  }
  const layer = stack.getLayer(top.id);
  if (!layer) {
    return false;
  }
  return stack.dismiss(layer, undefined, { force: true });
}

/**
 * Bulk-dismiss with a void completion response, honoring {@link DismissAllMode}.
 * Open callers **resolve** with `undefined` — not cancel.
 * No-ops (resolved promise) when `stackId` is not materialized.
 */
export function dismissAllWithMode(
  client: LayerClient,
  stackId: string,
  mode: DismissAllMode,
): Promise<void> {
  if (!client.getStackIds().includes(stackId)) {
    return Promise.resolve();
  }
  return client.dismissAll(stackId, undefined, { mode });
}

/**
 * Force-clear via {@link LayerClient#cancelAll}.
 * Open callers **reject** with {@link LayerCancelledError}.
 * No-ops (resolved promise) when `stackId` is not materialized.
 */
export function forceClearStack(
  client: LayerClient,
  stackId: string,
): Promise<void> {
  if (!client.getStackIds().includes(stackId)) {
    return Promise.resolve();
  }
  return client.cancelAll(stackId, { reason: "cancelAll" });
}
