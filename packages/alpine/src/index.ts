import type {
  DataTag,
  DefaultLayerError,
  ErrorOf,
  InferValidatorOutput,
  LayerCallContext,
  LayerComponentProps,
  LayerGroupOptions,
  LayerHandle,
  LayerKey,
  LayerOptions,
  LayerStack,
  LayerState,
  OmitKeyof,
  OpenLayerOptions,
  ResponseOf,
  ValidatedLayerHandle,
  Validator,
} from "@stainless-code/layers";
import {
  childStackId,
  createCallContext,
  createLayer as createLayerHandle,
  createLayerGroup,
  keySignature,
  shallowArrayEqual,
  LayerClient,
} from "@stainless-code/layers";

import type { AlpineLike } from "./alpine-types.js";
import { getLayerClient, setLayerClient } from "./layer-client.js";

export * from "@stainless-code/layers";
/** Core headless factory — not the wired {@link createLayer}. */
export { createLayer as createLayerHandle } from "@stainless-code/layers";
export { getLayerClient, setLayerClient } from "./layer-client.js";
export type { AlpineLike } from "./alpine-types.js";

let alpineRuntime: AlpineLike | undefined;
let warnedMissingRuntime = false;

function setAlpineRuntime(Alpine: AlpineLike | undefined): void {
  alpineRuntime = Alpine;
  if (Alpine) warnedMissingRuntime = false;
}

/** Reactive holder when the plugin has run; plain object fallback for unit tests. */
function alpineReactive<T extends object>(seed: T): T {
  if (alpineRuntime) return alpineRuntime.reactive(seed);
  if (process.env.NODE_ENV !== "production" && !warnedMissingRuntime) {
    warnedMissingRuntime = true;
    console.warn(
      "[layers/alpine] useStack/useMutationFlow called before Alpine.plugin(layers); updates won't be reactive.",
    );
  }
  return seed;
}

/** Props bag for the current outlet row — keyed on outlet root elements. */
const layerPropsByElement = new WeakMap<Element, LayerComponentProps>();

/** Alpine marks teleported nodes with `_x_teleportBack` (private; verified in outlet DOM tests). */
type TeleportMarked = Element & { _x_teleportBack?: Element };

function findLayerProps(el: Element): LayerComponentProps | undefined {
  let node: Element | null = el;
  while (node) {
    const bag = layerPropsByElement.get(node);
    if (bag) return bag;
    const back: Element | undefined = (node as TeleportMarked)._x_teleportBack;
    if (back) {
      node = back;
      continue;
    }
    node = node.parentElement;
  }
  return undefined;
}

function syncLayerProps(
  Alpine: AlpineLike,
  root: Element,
  props: LayerComponentProps,
): void {
  const existing = layerPropsByElement.get(root);
  if (existing) {
    Object.assign(existing, props);
    return;
  }
  layerPropsByElement.set(root, Alpine.reactive({ ...props }));
}

function defaultSelector(states: LayerState[]): LayerState[] {
  return states;
}

type NoValidateOptions<Opts> = Opts extends { validate: Validator<unknown> }
  ? never
  : Opts;

export interface UseStackOptions<T = LayerState[]> {
  stack?: string;
  select?: (states: LayerState[]) => T;
  compare?: (a: T, b: T) => boolean;
  client?: LayerClient;
}

export interface UseLayerStateOptions<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
> {
  key: Key;
  stack?: string;
  select?: (states: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[]) => U;
  compare?: (a: U, b: U) => boolean;
}

/** Reactive stack accessor (`.current` + `callFor`). */
export interface AlpineStack<RootProps = unknown, T = LayerState[]> {
  readonly current: T;
  callFor(
    state: LayerState,
    rootProps?: RootProps,
  ): LayerCallContext<unknown, unknown, RootProps> | null;
  destroy(): void;
}

function createSnapshotSelector<T>(
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): { runSelect: (base: LayerState[]) => T } {
  let cache: { base: LayerState[]; value: T } | null = null;

  const runSelect = (base: LayerState[]): T => {
    const prev = cache;
    if (prev && prev.base === base) return prev.value;
    const next = select(base);
    if (prev && compare(prev.value, next)) {
      cache = { base, value: prev.value };
      return prev.value;
    }
    cache = { base, value: next };
    return next;
  };

  return { runSelect };
}

function makeAlpineStack<RootProps, T>(
  stack: LayerStack,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): AlpineStack<RootProps, T> {
  const { runSelect } = createSnapshotSelector(select, compare);
  const initial = runSelect(getSource());
  const holder = alpineReactive({ current: initial });

  const unsubscribe = stack.subscribe(() => {
    const prev = holder.current;
    const next = runSelect(getSource());
    if (!compare(prev, next)) {
      holder.current = next;
    }
  });

  return {
    get current() {
      return holder.current;
    },
    callFor(state, rootProps) {
      const layer = stack.getLayer(state.id);
      return layer
        ? (createCallContext(
            stack,
            layer,
            state,
            rootProps,
          ) as LayerCallContext<unknown, unknown, RootProps>)
        : null;
    },
    destroy() {
      unsubscribe();
    },
  };
}

function resolveClient(explicit?: LayerClient): LayerClient {
  return explicit ?? getLayerClient();
}

/**
 * Subscribe to a stack snapshot (`.current` + `callFor`).
 *
 * @default `stack` is `"default"`; `select` is identity; `compare` is `Object.is`.
 */
export function useStack<RootProps = unknown, T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): AlpineStack<RootProps, T> {
  const resolved = resolveClient(client ?? opts.client);
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (s: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeAlpineStack(stack, () => stack.getSnapshot(), select, compare);
}

/**
 * Subscribe to a stack's queued snapshot (`.current` + `callFor`).
 *
 * @default `stack` is `"default"`; `select` is identity; `compare` is `Object.is`.
 */
export function useQueuedStack<RootProps = unknown, T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): AlpineStack<RootProps, T> {
  const resolved = resolveClient(client ?? opts.client);
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (s: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeAlpineStack(
    stack,
    () => stack.getQueuedSnapshot(),
    select,
    compare,
  );
}

/**
 * Observe all mounted layers matching a key (`.current` + `callFor`).
 *
 * A {@link DataTag} key infers its response and error types.
 */
export function createLayerState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): AlpineStack<unknown, U> {
  const sig = keySignature(opts.key);
  return useStack<unknown, U>(
    {
      stack: opts.stack,
      select: (states) => {
        const filtered = states.filter(
          (s) => keySignature(s.key) === sig,
        ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
        return opts.select ? opts.select(filtered) : (filtered as unknown as U);
      },
      compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
      client,
    },
    client,
  );
}

/** Observe all queued layers matching a key. */
export function createLayerQueuedState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): AlpineStack<unknown, U> {
  const sig = keySignature(opts.key);
  return useQueuedStack<unknown, U>(
    {
      stack: opts.stack,
      select: (states) => {
        const filtered = states.filter(
          (s) => keySignature(s.key) === sig,
        ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
        return opts.select ? opts.select(filtered) : (filtered as unknown as U);
      },
      compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
      client,
    },
    client,
  );
}

export type WiredLayerHandle<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = LayerHandle<P, R, E, D, RP> & {
  readonly state: LayerState<P, R, E, D>[];
  readonly queued: LayerState<P, R, E, D>[];
  readonly top: LayerState<P, R, E, D> | null;
};

export type WiredValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  readonly state: LayerState<InferValidatorOutput<V>, R, E, D>[];
  readonly queued: LayerState<InferValidatorOutput<V>, R, E, D>[];
  readonly top: LayerState<InferValidatorOutput<V>, R, E, D> | null;
};

function createLayerImpl<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  const resolved = resolveClient(client);
  const stackId = options.stack ?? "default";
  const sig = keySignature(options.key);
  const selectByKey = (states: LayerState[]) =>
    states.filter((s) => keySignature(s.key) === sig) as LayerState<
      P,
      R,
      E,
      D
    >[];
  const stateObs = useStack<RP, LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const queuedObs = useQueuedStack<RP, LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const handle = createLayerHandle(options, resolved);
  Object.defineProperties(handle, {
    state: {
      get(): LayerState<P, R, E, D>[] {
        return stateObs.current;
      },
      enumerable: true,
    },
    queued: {
      get(): LayerState<P, R, E, D>[] {
        return queuedObs.current;
      },
      enumerable: true,
    },
    top: {
      get(): LayerState<P, R, E, D> | null {
        return stateObs.current.at(-1) ?? null;
      },
      enumerable: true,
    },
  });
  return handle as WiredLayerHandle<P, R, E, D, RP>;
}

/**
 * Drive a layer — wired handle with reactive `state` / `queued` / `top`.
 * Prefer `$layers.open` from markup when a typed handle is not needed.
 */
export function createLayer<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<InferValidatorOutput<V>, R, E, D, RP> & {
    key: LayerKey;
    validate: V;
  },
  client?: LayerClient,
): WiredValidatedLayerHandle<V, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: NoValidateOptions<LayerOptions<P, R, E, D, RP> & { key: LayerKey }>,
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  return createLayerImpl(options, client);
}

export interface MutationRun<R> {
  /** End the layer with `response` after the action succeeds. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** True while the async action passed to `run` is in flight. */
  readonly pending: boolean;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/** Coordinate `call.setRunning` with an async action; `orEnd` ends on success. */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  const holder = alpineReactive({ pending: false });
  return {
    get pending() {
      return holder.pending;
    },
    run: (fn) => ({
      orEnd: async (response: R) => {
        holder.pending = true;
        call.setRunning(true);
        try {
          await fn();
          call.end(response);
        } finally {
          call.setRunning(false);
          holder.pending = false;
        }
      },
    }),
  };
}

/** Open on a pre-bound stack; {@link DataTag} keys infer response/error types. */
export interface ScopedOpen {
  <P, R, E = DefaultLayerError, D = unknown, RootProps = unknown>(
    options: OmitKeyof<
      OpenLayerOptions<P, R, E, D, RootProps> & {
        key: DataTag<LayerKey, R, E>;
      },
      "stack" | "validate"
    >,
  ): Promise<R>;
  <P, R = void, E = DefaultLayerError, D = unknown, RootProps = unknown>(
    options: OmitKeyof<OpenLayerOptions<P, R, E, D, RootProps>, "stack">,
  ): Promise<R>;
}

export interface LayerGroup<RootProps = unknown> {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: AlpineStack<RootProps>;
  stackId: string;
  /** Tear down the child stack group subscription and dismiss child layers. */
  dispose(): void;
}

/**
 * Nested child stack for a parent layer call. Render with a nested
 * `x-layer-outlet` bound to {@link LayerGroup.stackId}.
 */
export function useLayerGroup<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
  options?: LayerGroupOptions,
  client?: LayerClient,
): LayerGroup<RootProps> {
  const resolved = resolveClient(client);
  const stackId = childStackId(call, options?.name);
  const group = createLayerGroup(resolved, call, options);
  const states = useStack<RootProps>({ stack: stackId }, resolved);
  const dispose = () => {
    group.dispose();
    resolved.dismissAll(group.stackId);
    states.destroy();
  };
  const open = (<
    P2,
    R2 = void,
    E = DefaultLayerError,
    D = unknown,
    RP = unknown,
  >(
    opts: OmitKeyof<OpenLayerOptions<P2, R2, E, D, RP>, "stack">,
  ) =>
    resolved.open({
      ...opts,
      stack: stackId,
    } as OpenLayerOptions<P2, R2, E, D, RP>)) as unknown as ScopedOpen;
  const dismissAll = (response?: unknown) =>
    resolved.dismissAll(stackId, response);
  return { open, dismissAll, states, stackId, dispose };
}

export interface AppStack {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: AlpineStack;
}

export interface StackHook {
  setClient: typeof setLayerClient;
  useAppStack: () => AppStack;
}

/**
 * Bind a named stack + client.
 * @returns `{ setClient, useAppStack }` — open/dismissAll/states scoped to `stack`.
 */
export function createStackHook(
  config: { client?: LayerClient; stack?: string } = {},
): StackHook {
  if (config.client !== undefined) {
    setLayerClient(config.client);
  }
  const stackId = config.stack ?? "default";
  return {
    setClient: setLayerClient,
    useAppStack() {
      const states = useStack({ stack: stackId });
      const client = getLayerClient();
      const open = (<
        P,
        R = void,
        E = DefaultLayerError,
        D = unknown,
        RootProps = unknown,
      >(
        options: OmitKeyof<OpenLayerOptions<P, R, E, D, RootProps>, "stack">,
      ) =>
        client.open({
          ...options,
          stack: stackId,
        } as OpenLayerOptions<P, R, E, D, RootProps>)) as unknown as ScopedOpen;
      const dismissAll = (response?: unknown) =>
        client.dismissAll(stackId, response);
      return { open, dismissAll, states };
    },
  };
}

function buildLayerComponentProps(
  stack: LayerStack,
  state: LayerState,
  rootProps?: unknown,
): LayerComponentProps | null {
  const layer = stack.getLayer(state.id);
  if (!layer) return null;
  const call = createCallContext(
    stack,
    layer,
    state,
    rootProps,
  ) as LayerCallContext<unknown, unknown>;
  return {
    call,
    payload: state.payload,
    data: state.data,
    error: state.error,
    phase: state.phase,
    transition: state.transition,
    dismissing: state.dismissing,
    actionStatus: state.actionStatus,
  };
}

function registerLayerOutletDirective(Alpine: AlpineLike): void {
  Alpine.directive("layer-outlet", (el, { expression }, utils) => {
    if (!(el instanceof HTMLTemplateElement)) {
      throw new Error(
        "[layers/alpine] x-layer-outlet must be used on a <template> element.",
      );
    }
    const template = el;
    const lookup = new Map<string, Element>();
    let stackId = "default";
    let stack: LayerStack | null = null;
    let unsubscribe: (() => void) | null = null;
    const rootProps: unknown = undefined;

    const syncStack = () => {
      if (!stack) return;
      const states = stack.getSnapshot();
      const nextIds = new Set(states.map((s) => s.id));

      for (const [id, node] of lookup) {
        if (nextIds.has(id)) continue;
        layerPropsByElement.delete(node);
        Alpine.destroyTree(node);
        node.remove();
        lookup.delete(id);
      }

      let insertAfter: ChildNode = template;
      for (const state of states) {
        let root = lookup.get(state.id);
        if (!root) {
          const fragment = template.content.cloneNode(true) as DocumentFragment;
          root =
            fragment.firstElementChild ??
            (() => {
              const wrap = document.createElement("div");
              wrap.append(...fragment.childNodes);
              return wrap;
            })();
          insertAfter.after(root);
          lookup.set(state.id, root);
          const props = buildLayerComponentProps(stack, state, rootProps);
          if (props) syncLayerProps(Alpine, root, props);
          Alpine.initTree(root);
        } else if (root.previousSibling !== insertAfter) {
          insertAfter.after(root);
          const props = buildLayerComponentProps(stack, state, rootProps);
          if (props) syncLayerProps(Alpine, root, props);
        } else {
          const props = buildLayerComponentProps(stack, state, rootProps);
          if (props) syncLayerProps(Alpine, root, props);
        }
        insertAfter = root;
      }
    };

    const bindStack = () => {
      unsubscribe?.();
      const client = getLayerClient();
      stack = client.getStack(stackId);
      unsubscribe = stack.subscribe(syncStack);
      syncStack();
    };

    if (expression.trim()) {
      const evaluateStackId = utils.evaluateLater(expression);
      utils.effect(() => {
        evaluateStackId((value) => {
          if (typeof value === "string" && value.length > 0) {
            stackId = value;
          } else {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[layers/alpine] x-layer-outlet expected a non-empty string stack id, got ${typeof value}; using "default". Quote the id: x-layer-outlet="'confirm'".`,
              );
            }
            stackId = "default";
          }
          bindStack();
        });
      });
    } else {
      utils.effect(() => {
        bindStack();
      });
    }

    utils.cleanup(() => {
      unsubscribe?.();
      for (const node of lookup.values()) {
        layerPropsByElement.delete(node);
        Alpine.destroyTree(node);
        node.remove();
      }
      lookup.clear();
    });
  });
}

interface LayerStackData {
  states: LayerState[];
  callFor(
    state: LayerState,
    rootProps?: unknown,
  ): LayerCallContext<unknown, unknown> | null;
  init(this: LayerStackData): void;
  destroy(this: LayerStackData & { _unsub?: () => void }): void;
}

function registerLayerStackData(Alpine: AlpineLike): void {
  Alpine.data("layerStack", ((stackId?: string) => {
    const id = stackId ?? "default";
    const data: LayerStackData = {
      states: [],
      callFor(state, rootProps) {
        const stack = getLayerClient().getStack(id);
        const layer = stack.getLayer(state.id);
        return layer
          ? (createCallContext(
              stack,
              layer,
              state,
              rootProps,
            ) as LayerCallContext<unknown, unknown>)
          : null;
      },
      init() {
        const stack = getLayerClient().getStack(id);
        const sync = () => {
          this.states.splice(0, this.states.length, ...stack.getSnapshot());
        };
        sync();
        (this as LayerStackData & { _unsub?: () => void })._unsub =
          stack.subscribe(sync);
      },
      destroy() {
        const self = this as LayerStackData & { _unsub?: () => void };
        self._unsub?.();
      },
    };
    return data;
  }) as unknown as (...args: unknown[]) => Record<string, unknown>);
}

function registerLayersMagic(Alpine: AlpineLike): void {
  Alpine.magic("layers", () => {
    const client = getLayerClient();
    return {
      open: client.open.bind(client),
      dismissAll: client.dismissAll.bind(client),
      getStack: client.getStack.bind(client),
    };
  });
}

function registerLayerMagic(Alpine: AlpineLike): void {
  // Return the reactive bag directly so Alpine tracks `$layer.phase` etc.
  Alpine.magic("layer", (el) => {
    const bag = findLayerProps(el);
    if (!bag) {
      throw new Error(
        "[layers/alpine] $layer is only available inside an x-layer-outlet row.",
      );
    }
    return bag;
  });
}

/**
 * Alpine plugin — registers `$layers`, `$layer`, `x-layer-outlet`, and
 * `Alpine.data('layerStack')`.
 */
export default function layers(Alpine: AlpineLike): void {
  setAlpineRuntime(Alpine);
  registerLayersMagic(Alpine);
  registerLayerMagic(Alpine);
  registerLayerOutletDirective(Alpine);
  registerLayerStackData(Alpine);
}

export { layers };
