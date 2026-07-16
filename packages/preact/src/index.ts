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
  createLayer,
  createLayerGroup,
  keySignature,
  shallowArrayEqual,
  LayerClient,
} from "@stainless-code/layers";
// Preact adapter — peer `preact` >=10.19.0 (`useSyncExternalStore` via
// preact/compat). Built with `h` (no JSX) so it ships no `react/jsx-runtime`.
import { createContext, Fragment, h } from "preact";
import type { ComponentChildren, ComponentType, VNode } from "preact";
import { useContext, useSyncExternalStore } from "preact/compat";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

export * from "@stainless-code/layers";

const LayerClientContext = createContext<LayerClient | null>(null);

/** Provide a {@link LayerClient} to the subtree, creating one when omitted. */
export function StackProvider(props: {
  client?: LayerClient;
  children: ComponentChildren;
}): VNode {
  const ref = useRef<LayerClient | null>(null);
  if (!ref.current && !props.client) {
    ref.current = new LayerClient();
  }
  const value = props.client ?? ref.current ?? undefined;
  if (!value) {
    throw new Error("[layers/preact] StackProvider received a falsy client");
  }
  return h(LayerClientContext.Provider, { value }, props.children) as VNode;
}

/** Return the nearest context-provided {@link LayerClient}. */
export function useLayerClient(): LayerClient {
  const client = useContext(LayerClientContext);
  if (!client) {
    throw new Error("[layers/preact] No <StackProvider> found!");
  }
  return client;
}

const emptySnapshot: LayerState[] = [];

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

export type WiredLayerHandle<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = LayerHandle<P, R, E, D, RP> & {
  state: LayerState<P, R, E, D>[];
  queued: LayerState<P, R, E, D>[];
  top: LayerState<P, R, E, D> | null;
};

export type WiredValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  state: LayerState<InferValidatorOutput<V>, R, E, D>[];
  queued: LayerState<InferValidatorOutput<V>, R, E, D>[];
  top: LayerState<InferValidatorOutput<V>, R, E, D> | null;
};

/**
 * Shared snapshot subscription primitive for mounted and queued stack hooks.
 *
 * Selector output is memoized against the stable snapshot reference so
 * `useSyncExternalStore` does not churn object or array selections.
 */
function useSnapshot<T>(
  stack: LayerStack,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): T {
  const selectRef = useRef(select);
  selectRef.current = select;
  const compareRef = useRef(compare);
  compareRef.current = compare;
  const cacheRef = useRef<{ base: LayerState[]; value: T } | null>(null);

  // Memoize the selected value against the stable base snapshot ref: return the
  // cached selection while the base is unchanged, and keep the old ref when a
  // new selection is `compare`-equal — so object/array selectors don't churn.
  const runSelect = useCallback((base: LayerState[]): T => {
    const prev = cacheRef.current;
    if (prev && prev.base === base) return prev.value;
    const next = selectRef.current(base);
    if (prev && compareRef.current(prev.value, next)) {
      cacheRef.current = { base, value: prev.value };
      return prev.value;
    }
    cacheRef.current = { base, value: next };
    return next;
  }, []);

  const subscribe = useCallback(
    (onStoreChange: () => void) => stack.subscribe(onStoreChange),
    [stack],
  );
  const getSnapshot = useCallback(
    () => runSelect(getSource()),
    [getSource, runSelect],
  );
  const getServerSnapshot = useCallback(
    () => runSelect(emptySnapshot),
    [runSelect],
  );
  // @ts-expect-error preact/compat types omit getServerSnapshot (SSR 3rd arg)
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Subscribe to a selected slice of a stack's mounted snapshot.
 *
 * @param compare Equality check used to preserve the previous selection. Defaults to `Object.is`.
 */
export function useStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): T {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  const getSource = useCallback(() => stack.getSnapshot(), [stack]);
  return useSnapshot(stack, getSource, select, compare);
}

/** Subscribe to a selected slice of a stack's queued snapshot. */
export function useQueuedStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): T {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  const getSource = useCallback(() => stack.getQueuedSnapshot(), [stack]);
  return useSnapshot(stack, getSource, select, compare);
}

/**
 * Observe all mounted layers matching a key.
 *
 * A {@link DataTag} key infers its response and error types.
 */
export function useLayerState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): U {
  const sig = useMemo(() => keySignature(opts.key), [opts.key]);
  return useStack<U>(
    {
      stack: opts.stack,
      select: (states) => {
        const filtered = states.filter(
          (s) => keySignature(s.key) === sig,
        ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
        return opts.select ? opts.select(filtered) : (filtered as unknown as U);
      },
      compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
    },
    client,
  );
}

/** Observe all queued layers matching a key. */
export function useLayerQueuedState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): U {
  const sig = useMemo(() => keySignature(opts.key), [opts.key]);
  return useQueuedStack<U>(
    {
      stack: opts.stack,
      select: (states) => {
        const filtered = states.filter(
          (s) => keySignature(s.key) === sig,
        ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
        return opts.select ? opts.select(filtered) : (filtered as unknown as U);
      },
      compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
    },
    client,
  );
}

function useLayerImpl<P, R, E = DefaultLayerError, D = unknown, RP = unknown>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  const resolved = client ?? useLayerClient();
  const stackId = options.stack ?? "default";
  const sig = useMemo(() => keySignature(options.key), [options.key]);
  const selectByKey = useCallback(
    (states: LayerState[]) =>
      states.filter((s) => keySignature(s.key) === sig) as LayerState<
        P,
        R,
        E,
        D
      >[],
    [sig],
  );
  const state = useStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const queued = useQueuedStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const top = state.at(-1) ?? null;
  const handle = useMemo(
    () => createLayer(options, resolved),
    [resolved, options.key, options.stack],
  );
  // Preserve live `current` getter — object spread would freeze a render-time snapshot.
  return {
    ...handle,
    get current() {
      return handle.current;
    },
    state,
    queued,
    top,
  };
}

/** Wired handle: `createLayer` + reactive `state`/`queued`/`top`. */
export function useLayer<
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

export function useLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: NoValidateOptions<LayerOptions<P, R, E, D, RP> & { key: LayerKey }>,
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP>;

export function useLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  return useLayerImpl(options, client);
}

type AnyComponent = ComponentType<
  LayerComponentProps<never, never, never, never>
>;

export interface StackHandles {
  states: LayerState[];
  getCall: (state: LayerState) => LayerCallContext<unknown, unknown>;
}

/** Return the states and call contexts needed to render a stack headlessly. */
export function useStackHandles(
  stack = "default",
  rootProps?: unknown,
): StackHandles {
  const client = useLayerClient();
  const stk = client.getStack(stack);
  const states = useStack({ stack });
  const getCall = useCallback(
    (state: LayerState): LayerCallContext<unknown, unknown, unknown> => {
      const layer = stk.getLayer(state.id);
      // layer is present for any state in the snapshot; response type is
      // caller-defined, so the handle exposes the loose `unknown` shape.
      return createCallContext(
        stk,
        layer!,
        state,
        rootProps,
      ) as LayerCallContext<unknown, unknown, unknown>;
    },
    [stk, rootProps],
  );
  return { states, getCall };
}

/** Render every active layer in a stack with its registered component. */
export function StackOutlet(props: {
  stack?: string;
  rootProps?: unknown;
}): VNode {
  const client = useLayerClient();
  const stk = client.getStack(props.stack ?? "default");
  const { states, getCall } = useStackHandles(
    props.stack ?? "default",
    props.rootProps,
  );
  return h(
    Fragment,
    null,
    states.map((s) => {
      const layer = stk.getLayer(s.id);
      const Component = layer?.component as AnyComponent | undefined;
      if (!layer || !Component) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[layers/preact] No component for layer ${s.id} (key ${JSON.stringify(s.key)}); StackOutlet renders nothing. Provide a \`component\` or use useStackHandles.`,
          );
        }
        return null;
      }
      return h(Component, {
        key: s.id,
        call: getCall(s) as never,
        payload: s.payload as never,
        data: s.data as never,
        error: s.error as never,
        phase: s.phase,
        transition: s.transition,
        actionStatus: s.actionStatus,
        dismissing: s.dismissing,
      });
    }),
  ) as VNode;
}

/** Render a selected stack value through a render prop. */
export function StackSubscribe<T>(props: {
  stack?: string;
  selector: (states: LayerState[]) => T;
  children: (value: T) => ComponentChildren;
}): VNode {
  const value = useStack({ stack: props.stack, select: props.selector });
  return h(Fragment, null, props.children(value)) as VNode;
}

export interface MutationRun<R> {
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** True while a `run(...)` async action is in flight. Mirrors the layer's `actionStatus: "running"`. */
  pending: boolean;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```tsx
 * import {
 *   type LayerComponentProps,
 *   useMutationFlow,
 * } from "@stainless-code/preact-layers";
 *
 * function Confirm({ call }: LayerComponentProps<void, boolean>) {
 *   const flow = useMutationFlow(call);
 *   return (
 *     <button
 *       disabled={flow.pending}
 *       onClick={() => void flow.run(() => Promise.resolve()).orEnd(true)}
 *     >
 *       Confirm
 *     </button>
 *   );
 * }
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    (fn: () => Promise<void> | void): MutationRun<R> => ({
      orEnd: async (response: R) => {
        setPending(true);
        call.setRunning(true);
        try {
          await fn();
          call.end(response);
        } finally {
          call.setRunning(false);
          setPending(false);
        }
      },
    }),
    [call],
  );

  return { pending, run };
}

/** Open a layer on a pre-bound stack, with {@link DataTag} response and error inference. */
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

export interface LayerGroup {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: LayerState[];
  /** Renders the child stack inline — place inside the parent layer's DOM. */
  Outlet: ComponentType<{ rootProps?: unknown }>;
  stackId: string;
}

/**
 * Create a child stack scoped to the calling layer's lifetime.
 *
 * The child stack is disposed and dismissed when its parent layer unmounts.
 */
export function useLayerGroup<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
  options?: LayerGroupOptions,
): LayerGroup {
  const client = useLayerClient();
  const stackId = childStackId(call, options?.name);

  useEffect(() => {
    const group = createLayerGroup(client, call, options);
    return () => {
      group.dispose();
      client.dismissAll(group.stackId);
    };
  }, [client, stackId]);

  const states = useStack({ stack: stackId });
  const open = useCallback(
    <P2, R2 = void, E = DefaultLayerError, D = unknown, RP = unknown>(
      opts: OmitKeyof<OpenLayerOptions<P2, R2, E, D, RP>, "stack">,
    ) =>
      client.open({
        ...opts,
        stack: stackId,
      } as OpenLayerOptions<P2, R2, E, D, RP>),
    [client, stackId],
  );
  const dismissAll = useCallback(
    (response?: unknown) => client.dismissAll(stackId, response),
    [client, stackId],
  );
  const Outlet = useMemo(
    () =>
      function LayerGroupOutlet(props: { rootProps?: unknown }): VNode {
        return h(StackOutlet, {
          stack: stackId,
          rootProps: props.rootProps,
        }) as VNode;
      },
    [stackId],
  );

  return {
    open: open as unknown as ScopedOpen,
    dismissAll,
    states,
    Outlet,
    stackId,
  };
}

export interface AppStack {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: LayerState[];
}

export interface AppLayerProps<P, R = void> {
  /** Layer definition with the stack supplied by the factory. */
  options: OmitKeyof<LayerOptions<P, R>, "stack">;
  /** Controlled visibility. `true` opens the layer; `false` dismisses it. */
  open: boolean;
  payload: P;
  /** Called when the layer resolves. */
  onResolved?: (response: R) => void;
}

export interface StackHook<HostProps> {
  StackProvider: (props: {
    client?: LayerClient;
    children: ComponentChildren;
  }) => VNode;
  useAppStack: () => AppStack;
  AppHost: (props: HostProps) => VNode;
  AppLayer: <P, R = void>(props: AppLayerProps<P, R>) => null;
}

/** Create provider, host, controlled-layer, and access hooks bound to one stack. */
export function createStackHook<HostProps extends object = object>(
  config: {
    client?: LayerClient;
    stack?: string;
    Host?: ComponentType<{ children: ComponentChildren } & HostProps>;
  } = {},
): StackHook<HostProps> {
  const stackId = config.stack ?? "default";

  function BoundStackProvider(props: {
    client?: LayerClient;
    children: ComponentChildren;
  }): VNode {
    return h(StackProvider, {
      client: props.client ?? config.client,
      children: props.children,
    }) as VNode;
  }

  function useAppStack(): AppStack {
    const client = useLayerClient();
    const states = useStack({ stack: stackId });
    const open = useCallback(
      <P, R = void, E = DefaultLayerError, D = unknown, RootProps = unknown>(
        options: OmitKeyof<OpenLayerOptions<P, R, E, D, RootProps>, "stack">,
      ) =>
        client.open({
          ...options,
          stack: stackId,
        } as OpenLayerOptions<P, R, E, D, RootProps>),
      [client],
    );
    const dismissAll = useCallback(
      (response?: unknown) => client.dismissAll(stackId, response),
      [client],
    );
    return { open: open as unknown as ScopedOpen, dismissAll, states };
  }

  function AppHost(props: HostProps): VNode {
    const Host = config.Host;
    const outlet = h(StackOutlet, { stack: stackId, rootProps: props });
    return Host
      ? (h(Host, { ...props, children: outlet }) as VNode)
      : (outlet as VNode);
  }

  function AppLayer<P, R = void>(props: AppLayerProps<P, R>): null {
    const client = useLayerClient();
    const openedRef = useRef(false);
    const clientRef = useRef(client);
    clientRef.current = client;
    const optionsRef = useRef(props.options);
    optionsRef.current = props.options;
    const payloadRef = useRef(props.payload);
    payloadRef.current = props.payload;
    const onResolvedRef = useRef(props.onResolved);
    onResolvedRef.current = props.onResolved;

    useEffect(() => {
      const c = clientRef.current;
      if (props.open && !openedRef.current) {
        openedRef.current = true;
        void c
          .open<P, R>({
            ...optionsRef.current,
            stack: stackId,
            payload: payloadRef.current,
          } as OpenLayerOptions<P, R>)
          .then((response) => {
            openedRef.current = false;
            onResolvedRef.current?.(response);
          });
      } else if (!props.open && openedRef.current) {
        const stack = c.getStack(stackId);
        const layer = stack.find(optionsRef.current.key);
        if (layer) {
          stack.dismiss(layer, undefined);
        }
        openedRef.current = false;
      }
    }, [props.open]);

    useEffect(
      () => () => {
        if (openedRef.current) {
          const stack = clientRef.current.getStack(stackId);
          const layer = stack.find(optionsRef.current.key);
          if (layer) {
            stack.dismiss(layer, undefined);
          }
          openedRef.current = false;
        }
      },
      [],
    );

    return null;
  }

  return {
    StackProvider: BoundStackProvider,
    useAppStack,
    AppHost,
    AppLayer,
  };
}
