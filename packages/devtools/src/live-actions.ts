import type { DismissAllMode, LayerClient } from "@stainless-code/layers";

/** Soft-dismiss the top active layer (respects blockers). */
export function softDismissTop(
  client: LayerClient,
  stackId: string,
): Promise<boolean> | false {
  const stack = client.getStack(stackId);
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
  const stack = client.getStack(stackId);
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
  const stack = client.getStack(stackId);
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

/** Run {@link LayerClient#dismissAll} with an explicit mode. */
export function dismissAllWithMode(
  client: LayerClient,
  stackId: string,
  mode: DismissAllMode,
): Promise<void> {
  return client.dismissAll(stackId, undefined, { mode });
}
