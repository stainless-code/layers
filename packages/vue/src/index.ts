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
import {
  computed,
  defineComponent,
  Fragment,
  h,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from "vue";
import type {
  Component,
  ComputedRef,
  InjectionKey,
  PropType,
  Ref,
  SlotsType,
} from "vue";

export * from "@stainless-code/layers";

const LAYER_CLIENT_KEY: InjectionKey<LayerClient> = Symbol("layers.client");

/**
 * Provides a {@link LayerClient} to descendant components.
 *
 * @param client Client to provide. A new client is created when omitted.
 * @returns The provided client.
 */
export function provideLayerClient(client?: LayerClient): LayerClient {
  const c = client ?? new LayerClient();
  provide(LAYER_CLIENT_KEY, c);
  return c;
}

/**
 * Reads the nearest {@link LayerClient} from Vue injection context.
 *
 * @returns The nearest provided client.
 */
export function useLayerClient(): LayerClient {
  const c = inject(LAYER_CLIENT_KEY, undefined);
  if (!c) {
    throw new Error(
      "[layers/vue] No LayerClient provided — call provideLayerClient() in a parent setup().",
    );
  }
  return c;
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
  state: Readonly<Ref<LayerState<P, R, E, D>[]>>;
  queued: Readonly<Ref<LayerState<P, R, E, D>[]>>;
  top: Readonly<Ref<LayerState<P, R, E, D> | null>>;
};

export type WiredValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  state: Readonly<Ref<LayerState<InferValidatorOutput<V>, R, E, D>[]>>;
  queued: Readonly<Ref<LayerState<InferValidatorOutput<V>, R, E, D>[]>>;
  top: Readonly<Ref<LayerState<InferValidatorOutput<V>, R, E, D> | null>>;
};

/**
 * Shared snapshot subscription primitive for mounted and queued stack hooks.
 *
 * Selector output is memoized against the stable snapshot reference so refs do
 * not churn object or array selections.
 */
function useSnapshot<T>(
  stack: LayerStack,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): Readonly<Ref<T>> {
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

  const ref = shallowRef<T>(runSelect(getSource()));
  const unsubscribe = stack.subscribe(() => {
    const prev = ref.value;
    const next = runSelect(getSource());
    if (!compare(prev, next)) {
      ref.value = next;
    }
  });
  onScopeDispose(unsubscribe);
  return ref;
}

/**
 * Exposes a {@link LayerClient} stack as a readonly Vue ref.
 *
 * Call it inside `setup()` or an `effectScope()` so `onScopeDispose` can clean
 * up the stack subscription.
 *
 * @param opts Options bag: `stack`, `select`, `compare`.
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @returns A readonly ref of the selected stack value.
 * @default `stack` is `"default"`; `select` is identity; `compare` is
 * `Object.is`.
 */
export function useStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Readonly<Ref<T>> {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return useSnapshot(stack, () => stack.getSnapshot(), select, compare);
}

/** Exposes a stack's queued snapshot as a readonly Vue ref. */
export function useQueuedStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Readonly<Ref<T>> {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return useSnapshot(stack, () => stack.getQueuedSnapshot(), select, compare);
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
>(
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): Readonly<Ref<U>> {
  const sig = keySignature(opts.key);
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
>(
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): Readonly<Ref<U>> {
  const sig = keySignature(opts.key);
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
): WiredLayerHandle<P, R, E, D, RP> & {
  top: ComputedRef<LayerState<P, R, E, D> | null>;
} {
  const resolved = client ?? useLayerClient();
  const stackId = options.stack ?? "default";
  const sig = keySignature(options.key);
  const selectByKey = (states: LayerState[]) =>
    states.filter((s) => keySignature(s.key) === sig) as LayerState<
      P,
      R,
      E,
      D
    >[];
  const state = useStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const queued = useQueuedStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const top = computed(() => state.value.at(-1) ?? null);
  const base = createLayer(options, resolved);
  return {
    ...base,
    get current() {
      return base.current;
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

type AnyComponent = Component<LayerComponentProps<never, never, never, never>>;

/** Render every active layer in a stack with its registered component. */
export const StackOutlet = defineComponent({
  name: "StackOutlet",
  props: {
    stack: { type: String, default: "default" },
    rootProps: { type: null, default: undefined },
  },
  setup(props) {
    const client = useLayerClient();
    const stk = client.getStack(props.stack);
    const states = useStack({ stack: props.stack });
    return () =>
      h(
        Fragment,
        states.value.map((s) => {
          const layer = stk.getLayer(s.id);
          const Component = layer?.component as AnyComponent | undefined;
          if (!layer || !Component) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                `[layers/vue] No component for layer ${s.id} (key ${JSON.stringify(s.key)}); StackOutlet renders nothing. Provide a \`component\` or use useStack.`,
              );
            }
            return null;
          }
          const call = createCallContext(stk, layer, s, props.rootProps);
          return h(Component, {
            key: s.id,
            call: call as never,
            payload: s.payload as never,
            data: s.data as never,
            error: s.error as never,
            phase: s.phase,
            transition: s.transition,
            actionStatus: s.actionStatus,
            dismissing: s.dismissing,
          });
        }),
      );
  },
});

export interface StackSubscribeProps<T = LayerState[]> {
  stack?: string;
  selector: (states: LayerState[]) => T;
}

/**
 * Render a selected stack value through a default scoped slot (cross-adapter
 * parity). The slot payload is `{ value: unknown }` — `defineComponent` can't
 * thread the selector's return type through a slot; prefer
 * `useStack({ stack, select })` in `setup()` for a fully-typed value.
 *
 * @example
 * ```vue
 * <StackSubscribe :selector="(s) => s.length">
 *   <template #default="{ value }">{{ value }} open</template>
 * </StackSubscribe>
 * ```
 */
export const StackSubscribe = defineComponent({
  name: "StackSubscribe",
  props: {
    stack: { type: String, default: "default" },
    selector: {
      type: Function as PropType<(states: LayerState[]) => unknown>,
      required: true,
    },
  },
  slots: Object as SlotsType<{
    default: (payload: { value: unknown }) => unknown;
  }>,
  setup(props, { slots }) {
    const value = useStack({ stack: props.stack, select: props.selector });
    return () => slots.default?.({ value: value.value });
  },
});

export interface StackHandles {
  states: Readonly<Ref<LayerState[]>>;
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
  const getCall = (
    state: LayerState,
  ): LayerCallContext<unknown, unknown, unknown> => {
    const layer = stk.getLayer(state.id);
    return createCallContext(stk, layer!, state, rootProps) as LayerCallContext<
      unknown,
      unknown,
      unknown
    >;
  };
  return { states, getCall };
}

export interface MutationRun<R> {
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** True while a `run(...)` async action is in flight. Mirrors the layer's `actionStatus: "running"`. */
  pending: Readonly<Ref<boolean>>;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { type LayerComponentProps, useMutationFlow } from "@stainless-code/vue-layers";
 *
 * const props = defineProps<LayerComponentProps<void, boolean>>();
 * const flow = useMutationFlow(props.call);
 * </script>
 *
 * <template>
 *   <button
 *     :disabled="flow.pending.value"
 *     @click="flow.run(() => Promise.resolve()).orEnd(true)"
 *   >
 *     Confirm
 *   </button>
 * </template>
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  const pending = shallowRef(false);

  const run = (fn: () => Promise<void> | void): MutationRun<R> => ({
    orEnd: async (response: R) => {
      pending.value = true;
      call.setRunning(true);
      try {
        await fn();
        call.end(response);
      } finally {
        call.setRunning(false);
        pending.value = false;
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
  states: Readonly<Ref<LayerState[]>>;
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

  onScopeDispose(() => {
    group.dispose();
    client.cancelAll(group.stackId, { reason: "groupDispose" });
  });

  const states = useStack({ stack: stackId });
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
  const Outlet = defineComponent({
    name: "LayerGroupOutlet",
    props: {
      rootProps: { type: null, default: undefined },
    },
    setup(props) {
      return () =>
        h(StackOutlet, { stack: stackId, rootProps: props.rootProps });
    },
  });

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
  states: Readonly<Ref<LayerState[]>>;
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
  StackProvider: Component<{ client?: LayerClient }>;
  useAppStack: () => AppStack;
  /** Host props are forwarded to `config.Host` via fallthrough attrs. */
  AppHost: Component<HostProps>;
  AppLayer: <P, R = void>(props: AppLayerProps<P, R>) => null;
}

/** Create provider, host, controlled-layer, and access hooks bound to one stack. */
export function createStackHook<HostProps extends object = object>(
  config: {
    client?: LayerClient;
    stack?: string;
    Host?: Component<{ default?: unknown } & HostProps>;
  } = {},
): StackHook<HostProps> {
  const stackId = config.stack ?? "default";

  const StackProvider = defineComponent({
    name: "StackProvider",
    props: {
      client: {
        type: Object as PropType<LayerClient>,
        default: undefined,
      },
    },
    setup(props, { slots }) {
      provideLayerClient(props.client ?? config.client);
      return () => slots.default?.();
    },
  });

  function useAppStack(): AppStack {
    const client = useLayerClient();
    const states = useStack({ stack: stackId });
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

  const AppHost = defineComponent({
    name: "AppHost",
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => {
        const outlet = h(StackOutlet, { stack: stackId, rootProps: attrs });
        return config.Host
          ? h(config.Host as Component, attrs, { default: () => outlet })
          : outlet;
      };
    },
  });

  const AppLayerComponent = defineComponent({
    name: "AppLayer",
    props: {
      options: {
        type: Object as PropType<
          OmitKeyof<LayerOptions<unknown, unknown>, "stack">
        >,
        required: true,
      },
      open: { type: Boolean, required: true },
      payload: { type: null, default: undefined },
      onResolved: {
        type: Function as PropType<(response: unknown) => void>,
        default: undefined,
      },
    },
    setup(props) {
      const client = useLayerClient();
      let opened = false;

      watch(
        () => props.open,
        (isOpen) => {
          if (isOpen && !opened) {
            opened = true;
            void client
              .open({
                ...props.options,
                stack: stackId,
                payload: props.payload,
              } as OpenLayerOptions<unknown, unknown>)
              .then((response) => {
                opened = false;
                props.onResolved?.(response);
              });
          } else if (!isOpen && opened) {
            const stack = client.getStack(stackId);
            const layer = stack.find(props.options.key);
            if (layer) {
              stack.dismiss(layer, undefined);
            }
            opened = false;
          }
        },
        { immediate: true },
      );

      onScopeDispose(() => {
        if (opened) {
          const stack = client.getStack(stackId);
          const layer = stack.find(props.options.key);
          if (layer) {
            stack.dismiss(layer, undefined);
          }
          opened = false;
        }
      });

      return () => null;
    },
  });

  const AppLayer = AppLayerComponent as unknown as <P, R = void>(
    props: AppLayerProps<P, R>,
  ) => null;

  return {
    StackProvider,
    useAppStack,
    AppHost: AppHost as unknown as Component<HostProps>,
    AppLayer,
  };
}
