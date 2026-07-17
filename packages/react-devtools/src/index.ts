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

export const LayersDevtoolsPanel =
  process.env.NODE_ENV !== "development"
    ? LayersDevtoolsPanelNoOp
    : LayersDevtoolsPanelImpl;

export { LayersDevtoolsPanelNoOp };

export const layersDevtoolsPlugin =
  process.env.NODE_ENV !== "development"
    ? layersDevtoolsNoOpPlugin
    : layersDevtoolsPluginImpl;

export { layersDevtoolsNoOpPlugin };
