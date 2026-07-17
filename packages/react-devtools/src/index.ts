import {
  layersDevtoolsNoOpPlugin,
  layersDevtoolsPlugin as layersDevtoolsPluginImpl,
} from "./plugin";
import {
  LayersDevtoolsPanel as LayersDevtoolsPanelImpl,
  LayersDevtoolsPanelNoOp,
} from "./ReactLayersDevtools";

export type { LayersDevtoolsReactInit } from "./ReactLayersDevtools";
export type { LayersDevtoolsPluginOptions } from "./plugin";

/** Layers panel for TanStack Devtools (NoOp outside `development`). */
export const LayersDevtoolsPanel =
  process.env.NODE_ENV !== "development"
    ? LayersDevtoolsPanelNoOp
    : LayersDevtoolsPanelImpl;

/** No-op panel for production / non-development bundles. */
export { LayersDevtoolsPanelNoOp };

/** TanStack Devtools plugin (NoOp outside `development`). */
export const layersDevtoolsPlugin =
  process.env.NODE_ENV !== "development"
    ? layersDevtoolsNoOpPlugin
    : layersDevtoolsPluginImpl;

/** No-op plugin factory for production / non-development bundles. */
export { layersDevtoolsNoOpPlugin };
