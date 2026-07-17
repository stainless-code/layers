import type { LayerClient } from "@stainless-code/layers";

import { layersEventClient } from "./event-client";
import { getAttachedLayerClient, setAttachedLayerClient } from "./live-client";

function emitStackRegistry(client: LayerClient): void {
  layersEventClient.emit("stack-registry", {
    stackIds: client.getStackIds(),
  });
}

/** Re-emit current snapshots so the panel is not empty until the next mutation. */
function seedStackStates(client: LayerClient): void {
  for (const stackId of client.getStackIds()) {
    client.getStack(stackId).emitRegisterNotify();
  }
}

/** Bridge a {@link LayerClient} into the TanStack Devtools event bus. */
export function attachLayerDevtools(client: LayerClient): () => void {
  setAttachedLayerClient(client);

  const offNotify = client.subscribeNotify((event) => {
    layersEventClient.emit("stack-state", event);
  });

  const offStacks = client.subscribeStacks(() => {
    emitStackRegistry(client);
  });

  emitStackRegistry(client);
  seedStackStates(client);

  return () => {
    offNotify();
    offStacks();
    // Clear only if this attach still owns the live ref (re-attach may have replaced it).
    if (getAttachedLayerClient() === client) {
      setAttachedLayerClient(null);
    }
  };
}
