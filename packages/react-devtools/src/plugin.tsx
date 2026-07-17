import type { LayerClient } from "@stainless-code/layers";
import { createReactPlugin } from "@tanstack/devtools-utils/react";

import { LayersDevtoolsPanel } from "./ReactLayersDevtools";

export interface LayersDevtoolsPluginOptions {
  client?: LayerClient;
}

type LayersDevtoolsPluginFactory = ReturnType<typeof createReactPlugin>[0];

const defaultLayersPlugins = createReactPlugin({
  name: "TanStack Layers",
  Component: LayersDevtoolsPanel,
});

export function layersDevtoolsPlugin(
  opts?: LayersDevtoolsPluginOptions,
): ReturnType<LayersDevtoolsPluginFactory> {
  if (!opts?.client) {
    return defaultLayersPlugins[0]();
  }
  const withClient = createReactPlugin({
    name: "TanStack Layers",
    Component: (panelProps) => (
      <LayersDevtoolsPanel {...panelProps} client={opts.client} />
    ),
  });
  return withClient[0]();
}

export const layersDevtoolsNoOpPlugin: LayersDevtoolsPluginFactory =
  defaultLayersPlugins[1];
