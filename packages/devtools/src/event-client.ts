import type { StackNotifyEvent } from "@stainless-code/layers";
import { EventClient } from "@tanstack/devtools-event-client";

export interface LayersStackRegistryPayload {
  stackIds: string[];
}

/** Suffix-only keys: {@link EventClient} prepends `pluginId:` (`layers:`) at runtime. */
export interface LayersEventMap {
  "stack-state": StackNotifyEvent;
  "stack-registry": LayersStackRegistryPayload;
}

class LayersDevtoolsEventClient extends EventClient<LayersEventMap> {
  constructor() {
    super({
      pluginId: "layers",
      /**
       * TanStack Devtools starts `ClientEventBus` inside an async dynamic import
       * after the first commit. Layers often emit during the first open right
       * after attach. Default reconnect timing is often too short; Form/Pacer
       * use 1000ms here for the same reason.
       */
      reconnectEveryMs: 1000,
    });
  }
}

export const layersEventClient = new LayersDevtoolsEventClient();
