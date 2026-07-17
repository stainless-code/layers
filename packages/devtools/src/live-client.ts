import type { LayerClient } from "@stainless-code/layers";

let attachedClient: LayerClient | null = null;

/** Registers the live {@link LayerClient} for panel action buttons. */
export function setAttachedLayerClient(client: LayerClient | null): void {
  attachedClient = client;
}

/** Live client from the most recent {@link attachLayerDevtools} call. */
export function getAttachedLayerClient(): LayerClient | null {
  return attachedClient;
}
