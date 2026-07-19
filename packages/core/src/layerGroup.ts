import type { LayerClient } from "./layerClient";
import type {
  DefaultLayerError,
  LayerCallContext,
  OpenLayerOptions,
  StackOptions,
} from "./types";

/** Customizes child-stack identity and lifecycle. */
export interface LayerGroupOptions {
  /**
   * Distinguishes sibling groups owned by the same parent.
   * @default "group"
   */
  name?: string;
  scope?: StackOptions["scope"];
  gcTime?: StackOptions["gcTime"];
}

/** Controls a child stack bound to its parent layer's lifetime. */
export interface LayerGroupHandle {
  readonly stackId: string;
  /** Opens a layer with the child stack pre-bound. */
  open<P, R = void, E = DefaultLayerError, D = unknown, RootProps = unknown>(
    options: Omit<OpenLayerOptions<P, R, E, D, RootProps>, "stack">,
  ): Promise<R>;
  dismissAll(response?: unknown): void;
  /** Removes the parent-lifetime binding when its owner unmounts. */
  dispose(): void;
}

/** Derives a collision-free path id: `${parentStackId}~${parentLayerId}~${name}`. */
export function childStackId(
  parent: Pick<LayerCallContext<unknown, unknown>, "stackId" | "layerId">,
  name = "group",
): string {
  return `${parent.stackId}~${parent.layerId}~${name}`;
}

/**
 * Creates a child stack that is `cancelAll`'d (`LayerCancelledError`, reason
 * `parentDismiss`) when its parent dismisses. Pass the {@link LayerClient} that
 * owns `parent`; another client cannot observe the parent's lifetime.
 *
 * @example
 * ```ts
 * import {
 *   createLayerGroup,
 *   type LayerCallContext,
 *   type LayerClient,
 * } from "@stainless-code/layers";
 *
 * declare const client: LayerClient;
 * declare const parent: LayerCallContext<unknown, unknown>;
 *
 * const group = createLayerGroup(client, parent, { name: "nested" });
 * group.dismissAll();
 * group.dispose();
 * ```
 */
export function createLayerGroup(
  client: LayerClient,
  parent: Pick<LayerCallContext<unknown, unknown>, "stackId" | "layerId">,
  options: LayerGroupOptions = {},
): LayerGroupHandle {
  const stackId = childStackId(parent, options.name);
  client.ensureStack(stackId, { scope: options.scope, gcTime: options.gcTime });
  const unbind = client.bindChildStack(parent.layerId, stackId);
  return {
    stackId,
    open: <
      P,
      R = void,
      E = DefaultLayerError,
      D = unknown,
      RootProps = unknown,
    >(
      opts: Omit<OpenLayerOptions<P, R, E, D, RootProps>, "stack">,
    ): Promise<R> =>
      client.open({
        ...opts,
        stack: stackId,
      } as OpenLayerOptions<P, R, E, D, RootProps>) as Promise<R>,
    dismissAll: (response) => client.dismissAll(stackId, response),
    dispose: unbind,
  };
}
