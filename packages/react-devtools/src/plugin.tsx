import type { LayerClient } from "@stainless-code/layers";
import { createReactPlugin } from "@tanstack/devtools-utils/react";

import { LayersDevtoolsPanel } from "./ReactLayersDevtools";

/** Optional client override when the panel should not use the attached live client. */
export interface LayersDevtoolsPluginOptions {
  client?: LayerClient;
}

type LayersDevtoolsPluginFactory = ReturnType<typeof createReactPlugin>[0];

const defaultLayersPlugins = createReactPlugin({
  name: "TanStack Layers",
  Component: LayersDevtoolsPanel,
});

/**
 * TanStack Devtools plugin for Layers — mounts the Solid inspector via the
 * React doorbell. Pass `{ client }` to bind a specific {@link LayerClient};
 * otherwise the panel uses the client from {@link attachLayerDevtools}.
 */
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

/** No-op TanStack Devtools plugin for production / non-development bundles. */
export const layersDevtoolsNoOpPlugin: LayersDevtoolsPluginFactory =
  defaultLayersPlugins[1];
