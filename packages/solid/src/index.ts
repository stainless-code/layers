import type {
  DataTag,
  DefaultLayerError,
  ErrorOf,
  LayerCallContext,
  LayerComponentProps,
  LayerGroupOptions,
  LayerKey,
  LayerOptions,
  LayerState,
  OmitKeyof,
  OpenLayerOptions,
  ResponseOf,
} from "@stainless-code/layers";
import {
  childStackId,
  createCallContext,
  createLayerGroup,
  keySignature,
  LayerClient,
} from "@stainless-code/layers";
import {
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  from,
  onCleanup,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

export * from "@stainless-code/layers";

/** Provides a {@link LayerClient} to a Solid component tree. */
export const LayerClientContext = createContext<LayerClient>();

/** Reads the nearest {@link LayerClient} from Solid context. */
export function useLayerClient(): LayerClient {
  const c = useContext(LayerClientContext);
  if (!c) {
    throw new Error(
      "[layers/solid] No LayerClient in context — wrap your tree with <LayerClientContext.Provider value={client}>.",
    );
  }
  return c;
}

function defaultSelector(states: LayerState[]): LayerState[] {
  return states;
}

/**
 * Bridges a {@link LayerClient} stack into Solid reactivity through `from`.
 * The stack is resolved once, so keep `stackId` stable for the owner's lifetime.
 *
 * @param stackId - Stack to observe.
 * @param selector - Derives the value exposed by the accessor.
 * @param compare - Prevents updates when selected values are equal.
 * @returns An `Accessor` containing the selected stack value.
 * @default stackId `"default"`; compare `Object.is`.
 */
export function useStack<T = LayerState[]>(
  client: LayerClient,
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Accessor<T>;
export function useStack<T = LayerState[]>(
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Accessor<T>;
export function useStack<T = LayerState[]>(
  clientOrStackId?: LayerClient | string,
  stackIdOrSelector?: string | ((states: LayerState[]) => T),
  selectorOrCompare?: ((states: LayerState[]) => T) | ((a: T, b: T) => boolean),
  compareArg?: (a: T, b: T) => boolean,
): Accessor<T> {
  const explicit = clientOrStackId instanceof LayerClient;
  const client = explicit ? clientOrStackId : useLayerClient();
  const stackId =
    ((explicit ? stackIdOrSelector : clientOrStackId) as string | undefined) ??
    "default";
  const selector =
    ((explicit ? selectorOrCompare : stackIdOrSelector) as
      | ((states: LayerState[]) => T)
      | undefined) ?? (defaultSelector as unknown as (s: LayerState[]) => T);
  const compare =
    ((explicit ? compareArg : selectorOrCompare) as
      | ((a: T, b: T) => boolean)
      | undefined) ?? Object.is;
  const stack = client.getStack(stackId);
  return from<T>((set) => {
    let cache: { base: LayerState[]; value: T } | null = null;

    // Memoize the selected value against the stable base snapshot ref: return the
    // cached selection while the base is unchanged, and keep the old ref when a
    // new selection is `compare`-equal — so object/array selectors don't churn.
    const select = (base: LayerState[]): T => {
      const prev = cache;
      if (prev && prev.base === base) return prev.value;
      const next = selector(base);
      if (prev && compare(prev.value, next)) {
        cache = { base, value: prev.value };
        return prev.value;
      }
      cache = { base, value: next };
      return next;
    };

    const push = () => {
      const prev = cache?.value;
      const next = select(stack.getSnapshot());
      if (prev === undefined || !compare(prev, next)) {
        set(() => next);
      }
    };
    const unsubscribe = stack.subscribe(push);
    push(); // pull-model: no initial notification, so read it ourselves
    return unsubscribe;
  }) as Accessor<T>;
}

/** Observes one active layer by key as an `Accessor`, or `null` when inactive. */
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  client: LayerClient,
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Accessor<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Accessor<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  clientOrKey: LayerClient | Key,
  keyOrStackId?: Key | string,
  stackIdOrCompare?:
    | string
    | ((
        a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
        b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
      ) => boolean),
  compareArg?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Accessor<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null> {
  const explicit = clientOrKey instanceof LayerClient;
  const client = explicit ? clientOrKey : useLayerClient();
  const key = (explicit ? keyOrStackId : clientOrKey) as Key;
  const stackId =
    ((explicit ? stackIdOrCompare : keyOrStackId) as string | undefined) ??
    "default";
  const compare =
    ((explicit ? compareArg : stackIdOrCompare) as
      | ((
          a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
          b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
        ) => boolean)
      | undefined) ?? Object.is;
  const sig = keySignature(key);
  return useStack(
    client,
    stackId,
    (states) =>
      (states.find((s) => keySignature(s.key) === sig) ?? null) as LayerState<
        P,
        ResponseOf<Key>,
        ErrorOf<Key>,
        D
      > | null,
    compare,
  ) as Accessor<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
}

type AnyComponent = Component<LayerComponentProps<never, never, never, never>>;

export interface StackHandles {
  states: Accessor<LayerState[]>;
  getCall: (state: LayerState) => LayerCallContext<unknown, unknown>;
}

/** Return the states and call contexts needed to render a stack headlessly. */
export function useStackHandles(
  stack = "default",
  rootProps?: unknown,
): StackHandles {
  const client = useLayerClient();
  const stk = client.getStack(stack);
  const states = useStack(stack);
  const getCall = (
    state: LayerState,
  ): LayerCallContext<unknown, unknown, unknown> =>
    createCallContext(
      stk,
      stk.getLayer(state.id)!,
      state,
      rootProps,
    ) as LayerCallContext<unknown, unknown, unknown>;
  return { states, getCall };
}

/** Render every active layer in a stack with its registered component. */
export function StackOutlet(props: {
  stack?: string;
  rootProps?: unknown;
}): JSX.Element {
  const client = useLayerClient();
  const stackId = props.stack ?? "default";
  const stk = client.getStack(stackId);
  const { states, getCall } = useStackHandles(stackId, props.rootProps);
  return createComponent(For, {
    get each() {
      return states().map((s) => s.id);
    },
    children: (id: string) => {
      // Runs once per id (For keys by primitive id). Capture the component
      // statically so `Dynamic` never recreates the instance; only the prop
      // getters below are reactive, so state changes update props in place.
      const initial = states().find((s) => s.id === id);
      const layer = stk.getLayer(id);
      const component = layer?.component as AnyComponent | undefined;
      if (!component) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[layers/solid] No component for layer ${id} (key ${JSON.stringify(initial?.key)}); StackOutlet renders nothing. Provide a \`component\` or use useStackHandles.`,
          );
        }
        return null;
      }
      const state = createMemo(() => states().find((s) => s.id === id));
      const st = (): LayerState => state() ?? initial!;
      return createComponent(Dynamic, {
        component,
        get call() {
          return getCall(st()) as never;
        },
        get payload() {
          return st().payload as never;
        },
        get data() {
          return st().data as never;
        },
        get error() {
          return st().error as never;
        },
        get phase() {
          return st().phase;
        },
        get transition() {
          return st().transition;
        },
        get actionStatus() {
          return st().actionStatus;
        },
        get dismissing() {
          return st().dismissing;
        },
      });
    },
  });
}

/** Render a selected stack value through a render prop. */
export function StackSubscribe<T>(props: {
  stack?: string;
  selector: (states: LayerState[]) => T;
  children: (value: Accessor<T>) => JSX.Element;
}): JSX.Element {
  const value = useStack(props.stack, props.selector);
  return props.children(value);
}

export interface MutationRun<R> {
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** True while a `run(...)` async action is in flight. Mirrors the layer's `actionStatus: "running"`. */
  pending: Accessor<boolean>;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```tsx
 * import { type LayerComponentProps, useMutationFlow } from "@stainless-code/solid-layers";
 *
 * function Confirm(props: LayerComponentProps<void, boolean>) {
 *   const flow = useMutationFlow(props.call);
 *   return (
 *     <button
 *       disabled={flow.pending()}
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
  const [pending, setPending] = createSignal(false);

  const run = (fn: () => Promise<void> | void): MutationRun<R> => ({
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
  });

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
  states: Accessor<LayerState[]>;
  /** Renders the child stack inline — place inside the parent layer's DOM. */
  Outlet: Component<{ rootProps?: unknown }>;
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
  const group = createLayerGroup(client, call, options);

  onCleanup(() => {
    group.dispose();
    client.dismissAll(group.stackId);
  });

  const states = useStack(stackId);
  const open = <
    P2,
    R2 = void,
    E = DefaultLayerError,
    D = unknown,
    RP = unknown,
  >(
    opts: OmitKeyof<OpenLayerOptions<P2, R2, E, D, RP>, "stack">,
  ) =>
    client.open({
      ...opts,
      stack: stackId,
    } as OpenLayerOptions<P2, R2, E, D, RP>);
  const dismissAll = (response?: unknown) =>
    client.dismissAll(stackId, response);

  function LayerGroupOutlet(props: { rootProps?: unknown }) {
    return createComponent(StackOutlet, {
      stack: stackId,
      get rootProps() {
        return props.rootProps;
      },
    });
  }

  return {
    open: open as unknown as ScopedOpen,
    dismissAll,
    states,
    Outlet: LayerGroupOutlet,
    stackId,
  };
}

export interface AppStack {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: Accessor<LayerState[]>;
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
    children: JSX.Element;
  }) => JSX.Element;
  useAppStack: () => AppStack;
  AppHost: (props: HostProps) => JSX.Element;
  AppLayer: <P, R = void>(props: AppLayerProps<P, R>) => null;
}

/** Create provider, host, controlled-layer, and access hooks bound to one stack. */
export function createStackHook<HostProps extends object = object>(
  config: {
    client?: LayerClient;
    stack?: string;
    Host?: Component<{ children: JSX.Element } & HostProps>;
  } = {},
): StackHook<HostProps> {
  const stackId = config.stack ?? "default";
  const fallback = config.client ?? new LayerClient();

  function StackProvider(props: {
    client?: LayerClient;
    children: JSX.Element;
  }): JSX.Element {
    return createComponent(LayerClientContext.Provider, {
      get value() {
        return props.client ?? fallback;
      },
      get children() {
        return props.children;
      },
    });
  }

  function useAppStack(): AppStack {
    const client = useLayerClient();
    const states = useStack(stackId);
    const open = <
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
      } as OpenLayerOptions<P, R, E, D, RootProps>);
    const dismissAll = (response?: unknown) =>
      client.dismissAll(stackId, response);
    return { open: open as unknown as ScopedOpen, dismissAll, states };
  }

  function AppHost(props: HostProps): JSX.Element {
    const outlet = createComponent(StackOutlet, {
      stack: stackId,
      rootProps: props,
    });
    const Host = config.Host;
    return Host
      ? createComponent(Host, {
          ...(props as Record<string, unknown>),
          get children() {
            return outlet;
          },
        } as never)
      : outlet;
  }

  function AppLayer<P, R = void>(props: AppLayerProps<P, R>): null {
    const client = useLayerClient();
    let opened = false;

    createEffect(() => {
      const isOpen = props.open;
      if (isOpen && !opened) {
        opened = true;
        void client
          .open<P, R>(
            untrack(() => ({
              ...props.options,
              stack: stackId,
              payload: props.payload,
            })) as OpenLayerOptions<P, R>,
          )
          .then((response) => {
            opened = false;
            untrack(() => props.onResolved)?.(response);
          });
      } else if (!isOpen && opened) {
        const opts = untrack(() => props.options);
        const stack = client.getStack(stackId);
        const layer = stack.find(opts.key);
        if (layer) {
          stack.dismiss(layer, undefined);
        }
        opened = false;
      }
    });

    onCleanup(() => {
      if (opened) {
        const opts = untrack(() => props.options);
        const stack = client.getStack(stackId);
        const layer = stack.find(opts.key);
        if (layer) {
          stack.dismiss(layer, undefined);
        }
        opened = false;
      }
    });

    return null;
  }

  return {
    StackProvider,
    useAppStack,
    AppHost,
    AppLayer,
  };
}
