import { LayerClient } from "@stainless-code/layers";

let _client: LayerClient | undefined;
let _clientLocked = false;

/** @internal Test-only reset for module singleton state. */
export function __resetLayerClientForTests(): void {
  _client = undefined;
  _clientLocked = false;
}

function lockClient(): void {
  _clientLocked = true;
}

/**
 * Lazy {@link LayerClient} singleton. Created on first access when
 * {@link setLayerClient} has not run yet.
 */
export function getLayerClient(): LayerClient {
  lockClient();
  if (!_client) _client = new LayerClient();
  return _client;
}

/**
 * Pin the shared client before first use. Throws when called after the client
 * has been resolved lazily or by any adapter API.
 */
export function setLayerClient(client?: LayerClient): LayerClient {
  if (_clientLocked) {
    throw new Error(
      "[layers/alpine] setLayerClient() must be called before the first use of getLayerClient() or any adapter API that resolves the client implicitly.",
    );
  }
  lockClient();
  _client = client ?? new LayerClient();
  return _client;
}
