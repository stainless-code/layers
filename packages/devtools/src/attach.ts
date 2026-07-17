import type { LayerClient } from "@stainless-code/layers";

import { layersEventClient } from "./event-client";
import { getAttachedLayerClient, setAttachedLayerClient } from "./live-client";

/** Global prior detach — re-attach (any client) detaches first. */
let previousDetach: (() => void) | undefined;

function emitStackRegistry(client: LayerClient): void {
  layersEventClient.emit("stack-registry", {
    stackIds: client.getStackIds(),
  });
}

/** Re-emit current snapshots so the panel is not empty until the next mutation. */
function seedStackStates(client: LayerClient): void {
  client.seedNotify();
}

/** Bridge a {@link LayerClient} into the TanStack Devtools event bus. */
export function attachLayerDevtools(client: LayerClient): () => void {
  previousDetach?.();

  setAttachedLayerClient(client);

  const offNotify = client.subscribeNotify((event) => {
    layersEventClient.emit("stack-state", event);
  });

  const offStacks = client.subscribeStacks(() => {
    emitStackRegistry(client);
  });

  emitStackRegistry(client);
  seedStackStates(client);

  const detach = () => {
    offNotify();
    offStacks();
    if (previousDetach === detach) {
      previousDetach = undefined;
    }
    // Clear only if this attach still owns the live ref (re-attach may have replaced it).
    if (getAttachedLayerClient() === client) {
      setAttachedLayerClient(null);
    }
  };
  previousDetach = detach;
  return detach;
}
