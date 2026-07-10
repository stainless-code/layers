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
  defineComponent,
  Fragment,
  h,
  inject,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from "vue";
import type { Component, InjectionKey, PropType, Ref, SlotsType } from "vue";

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

/**
 * Exposes a {@link LayerClient} stack as a readonly Vue ref.
 *
 * Call it inside `setup()` or an `effectScope()` so `onScopeDispose` can clean
 * up the stack subscription.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param stackId Stack to observe.
 * @param selector Derives the ref value from the stack snapshot.
 * @param compare Determines whether a selected value changed.
 * @returns A readonly ref of the selected stack value.
 * @default `stackId` is `"default"`; `selector` is identity; `compare` is
 * `Object.is`.
 * @example
 * ```ts
 * import { useStack } from "@stainless-code/vue-layers";
 *
 * const stack = useStack("confirm");
 * console.log(stack.value);
 * ```
 */
export function useStack<T = LayerState[]>(
  client: LayerClient,
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Readonly<Ref<T>>;
export function useStack<T = LayerState[]>(
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Readonly<Ref<T>>;
export function useStack<T = LayerState[]>(
  clientOrStackId?: LayerClient | string,
  stackIdOrSelector?: string | ((states: LayerState[]) => T),
  selectorOrCompare?: ((states: LayerState[]) => T) | ((a: T, b: T) => boolean),
  compareArg?: (a: T, b: T) => boolean,
): Readonly<Ref<T>> {
  const explicit = clientOrStackId instanceof LayerClient;
  const client = explicit ? clientOrStackId : useLayerClient();
  const stackId =
    ((explicit ? stackIdOrSelector : clientOrStackId) as string | undefined) ??
    "default";
  const selector =
    ((explicit ? selectorOrCompare : stackIdOrSelector) as
      | ((states: LayerState[]) => T)
      | undefined) ??
    (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare =
    ((explicit ? compareArg : selectorOrCompare) as
      | ((a: T, b: T) => boolean)
      | undefined) ?? Object.is;

  const stack = client.getStack(stackId);
  let cache: { base: LayerState[]; value: T } | null = null;

  // Preserve selector output identity while the base snapshot is unchanged or
  // `compare` considers a new result equal, preventing object/array churn.
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

  const ref = shallowRef<T>(select(stack.getSnapshot()));
  const unsubscribe = stack.subscribe(() => {
    const prev = ref.value;
    const next = select(stack.getSnapshot());
    if (!compare(prev, next)) {
      ref.value = next;
    }
  });
  onScopeDispose(unsubscribe);
  return ref;
}

/**
 * Exposes one active layer as a readonly Vue ref.
 *
 * The subscription follows the current `setup()` or `effectScope()` lifetime.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param key Layer key to match.
 * @param stackId Stack to search.
 * @param compare Determines whether the matched state changed.
 * @returns A readonly ref whose value is `null` while the layer is inactive.
 * @default `stackId` is `"default"`; `compare` is `Object.is`.
 */
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  client: LayerClient,
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Readonly<Ref<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Readonly<Ref<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>>;
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
): Readonly<Ref<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>> {
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
  ) as Readonly<Ref<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>>;
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
    const states = useStack(props.stack);
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
 * thread the selector's return type through a slot; prefer `useStack(stack,
 * selector)` in `setup()` for a fully-typed value.
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
    const value = useStack(props.stack, props.selector);
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
  const states = useStack(stack);
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
