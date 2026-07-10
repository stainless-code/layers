import type { Layer } from "./layer";
import { LayerStack } from "./layerStack";
import type {
  DefaultLayerError,
  DismissOptions,
  LayerCallContext,
} from "./types";
import type { LayerState } from "./types";

/**
 * Creates the framework-neutral imperative context passed to a layer component.
 * Adapters provide rendering; stack and layer instances retain lifecycle control.
 */
export function createCallContext<P, R, RootProps = unknown>(
  stack: LayerStack<P, R, DefaultLayerError, unknown>,
  layer: Layer<P, R, DefaultLayerError, unknown>,
  state: LayerState<P, R, DefaultLayerError, unknown>,
  rootProps?: RootProps,
): LayerCallContext<P, R, RootProps> {
  return {
    end: (response: R, opts?: DismissOptions) =>
      stack.dismiss(layer, response, opts),
    dismiss: (response: R, opts?: DismissOptions) =>
      stack.dismiss(layer, response, opts),
    addBlocker: (fn) => layer.addBlocker(fn),
    update: (patch: Partial<P>) => stack.update(layer, patch),
    setRunning: (running: boolean) => stack.setRunning(layer, running),
    settle: () => stack.settle(layer),
    ended: state.ended,
    index: state.index,
    stackSize: state.stackSize,
    root: rootProps as RootProps,
    stackId: stack.id,
    layerId: layer.id,
  };
}
