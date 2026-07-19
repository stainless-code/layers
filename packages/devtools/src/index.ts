import * as Devtools from "./core";

/** Solid panel core for TanStack Devtools (NoOp outside `development`). */
export const LayersDevtoolsCore: typeof Devtools.LayersDevtoolsCore =
  process.env.NODE_ENV !== "development"
    ? Devtools.LayersDevtoolsCoreNoOp
    : Devtools.LayersDevtoolsCore;

export { attachLayerDevtools } from "./attach";
export { layersEventClient } from "./event-client";
export type {
  LayersEventMap,
  LayersStackRegistryPayload,
} from "./event-client";
export type { LayersDevtoolsInit } from "./core";
export {
  cancelQueuedHead,
  dismissAllWithMode,
  forceClearStack,
  forceDismissTop,
  softDismissTop,
} from "./live-actions";
