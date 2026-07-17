import type { LayerClient } from "@stainless-code/layers";
import {
  attachLayerDevtools,
  LayersDevtoolsCore,
} from "@stainless-code/layers-devtools";
import { useLayerClient } from "@stainless-code/react-layers";
import { createReactPanel } from "@tanstack/devtools-utils/react";
import type { DevtoolsPanelProps } from "@tanstack/devtools-utils/react";
import type { JSX } from "react";
import { useEffect } from "react";

export interface LayersDevtoolsReactInit extends Partial<DevtoolsPanelProps> {
  /** When set, skips {@link useLayerClient} for attach. */
  client?: LayerClient;
}

const layersDevtoolsPanels = createReactPanel(LayersDevtoolsCore);

type LayersDevtoolsPanelComponent = (
  props?: LayersDevtoolsReactInit,
) => JSX.Element;

function resolvePanelProps(
  props?: LayersDevtoolsReactInit,
): DevtoolsPanelProps {
  return {
    theme: props?.theme ?? "dark",
    devtoolsOpen: props?.devtoolsOpen ?? false,
  };
}

function LayersDevtoolsPanelMounted(
  props: LayersDevtoolsReactInit & { client: LayerClient },
) {
  useEffect(() => attachLayerDevtools(props.client), [props.client]);
  const Panel = layersDevtoolsPanels[0];
  return <Panel {...resolvePanelProps(props)} />;
}

function LayersDevtoolsPanelFromContext(props?: LayersDevtoolsReactInit) {
  const client = useLayerClient();
  return <LayersDevtoolsPanelMounted {...(props ?? {})} client={client} />;
}

/** Mounts the Solid Layers panel and auto-attaches the nearest {@link LayerClient}. */
export const LayersDevtoolsPanel: LayersDevtoolsPanelComponent = (props) => {
  if (props?.client) {
    return <LayersDevtoolsPanelMounted {...props} client={props.client} />;
  }
  return <LayersDevtoolsPanelFromContext {...(props ?? {})} />;
};

export const LayersDevtoolsPanelNoOp: LayersDevtoolsPanelComponent = (
  props,
) => {
  const Panel = layersDevtoolsPanels[1];
  return <Panel {...resolvePanelProps(props)} />;
};
