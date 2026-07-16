import {
  computed,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  signal,
  ViewContainerRef,
} from "@angular/core";
import type {
  ComponentRef,
  FactoryProvider,
  Signal,
  Type,
} from "@angular/core";
import type {
  DataTag,
  DefaultLayerError,
  ErrorOf,
  InferValidatorOutput,
  LayerCallContext,
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

export * from "@stainless-code/layers";

/** Identifies the app {@link LayerClient} in Angular dependency injection. */
export const LAYER_CLIENT = new InjectionToken<LayerClient>("layers.client");

/**
 * Creates a `FactoryProvider` for the app {@link LayerClient}.
 *
 * @param client - Client to provide; a new client is created when omitted.
 * @returns A `FactoryProvider` for `LAYER_CLIENT`.
 */
export function provideLayerClient(client?: LayerClient): FactoryProvider {
  return {
    provide: LAYER_CLIENT,
    useFactory: () => client ?? new LayerClient(),
  };
}

/** Injects the app {@link LayerClient}; must run in an Angular injection context. */
export function useLayerClient(): LayerClient {
  return inject(LAYER_CLIENT);
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
  state: Signal<LayerState<P, R, E, D>[]>;
  queued: Signal<LayerState<P, R, E, D>[]>;
  top: Signal<LayerState<P, R, E, D> | null>;
};

export type WiredValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  state: Signal<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  queued: Signal<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  top: Signal<LayerState<InferValidatorOutput<V>, R, E, D> | null>;
};

/**
 * Shared snapshot subscription primitive for mounted and queued stack hooks.
 *
 * Selector output is memoized against the stable snapshot reference so
 * subscribers do not churn object or array selections.
 */
function subscribeStackSnapshot<T>(
  stack: LayerStack,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): Signal<T> {
  let cache: { base: LayerState[]; value: T } | null = null;

  // Memoize the selected value against the stable base snapshot ref: return the
  // cached selection while the base is unchanged, and keep the old ref when a
  // new selection is `compare`-equal — so object/array selectors don't churn.
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

  const state = signal<T>(runSelect(getSource()));
  effect((onCleanup) => {
    // `effect()` runs after the current change-detection cycle, so a stack
    // mutation between signal creation and effect attach would leave the
    // signal stale. Re-read at attach time to close that gap.
    state.set(runSelect(getSource()));
    const unsubscribe = stack.subscribe(() => {
      const prev = state();
      const next = runSelect(getSource());
      if (!compare(prev, next)) {
        state.set(next);
      }
    });
    onCleanup(unsubscribe);
  });
  return state.asReadonly();
}

/**
 * Bridges a {@link LayerClient} stack into an Angular `Signal`.
 * Must run in an injection context because the subscription uses `effect()`.
 *
 * @param compare Equality check used to preserve the previous selection. Defaults to `Object.is`.
 */
export function useStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Signal<T> {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return subscribeStackSnapshot(
    stack,
    () => stack.getSnapshot(),
    select,
    compare,
  );
}

/** Subscribe to a selected slice of a stack's queued snapshot. */
export function useQueuedStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Signal<T> {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return subscribeStackSnapshot(
    stack,
    () => stack.getQueuedSnapshot(),
    select,
    compare,
  );
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
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): Signal<U> {
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
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): Signal<U> {
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

function injectLayerImpl<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
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
  const top = computed(() => state().at(-1) ?? null);
  const handle = createLayer(options, resolved);
  return Object.assign(handle, { state, queued, top });
}

/** Wired handle: `createLayer` + reactive `state`/`queued`/`top`. */
export function injectLayer<
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

export function injectLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: NoValidateOptions<LayerOptions<P, R, E, D, RP> & { key: LayerKey }>,
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP>;

export function injectLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  return injectLayerImpl(options, client);
}

/** Alias for {@link injectLayer}. */
export const useLayer = injectLayer;

/** Angular-idiomatic alias for {@link useStack}. */
export const injectStack = useStack;

/** Angular-idiomatic alias for {@link useQueuedStack}. */
export const injectQueuedStack = useQueuedStack;

/** Angular-idiomatic alias for {@link useLayerState}. */
export const injectLayerState = useLayerState;

/** Angular-idiomatic alias for {@link useLayerQueuedState}. */
export const injectLayerQueuedState = useLayerQueuedState;

export interface StackHandles {
  states: Signal<LayerState[]>;
  getCall: (state: LayerState) => LayerCallContext<unknown, unknown>;
}

/** Return the states and call contexts needed to render a stack headlessly. */
export function useStackHandles(
  stackId = "default",
  rootProps?: unknown,
): StackHandles {
  const client = useLayerClient();
  const stk = client.getStack(stackId);
  const states = useStack({ stack: stackId });
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

/**
 * Imperatively render every active layer in a stack into a `ViewContainerRef`.
 * Must run in an injection context (uses `inject` and `effect`).
 *
 * Components are keyed by stable layer `id` — state changes update inputs via
 * `setInput` without recreating the `ComponentRef`.
 */
export function renderStack(
  vcr: ViewContainerRef,
  stackId = "default",
  rootProps?: unknown,
): void {
  const client = useLayerClient();
  const stk = client.getStack(stackId);
  const states = useStack({ stack: stackId });
  const refs = new Map<string, ComponentRef<Record<string, unknown>>>();
  effect(() => {
    const current = states();
    const seen = new Set<string>();
    current.forEach((s, index) => {
      seen.add(s.id);
      const layer = stk.getLayer(s.id);
      const component = layer?.component as Type<unknown> | undefined;
      if (!component) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[layers/angular] No component for layer ${s.id} (key ${JSON.stringify(s.key)}); renderStack renders nothing. Provide a \`component\` or use useStackHandles.`,
          );
        }
        return;
      }
      let ref = refs.get(s.id);
      if (!ref) {
        ref = vcr.createComponent(component, {
          index,
        }) as ComponentRef<Record<string, unknown>>;
        refs.set(s.id, ref);
      }
      ref.setInput("call", createCallContext(stk, layer!, s, rootProps));
      ref.setInput("payload", s.payload);
      ref.setInput("data", s.data);
      ref.setInput("error", s.error);
      ref.setInput("phase", s.phase);
      ref.setInput("transition", s.transition);
      ref.setInput("actionStatus", s.actionStatus);
      ref.setInput("dismissing", s.dismissing);
    });
    for (const [id, ref] of refs) {
      if (!seen.has(id)) {
        ref.destroy();
        refs.delete(id);
      }
    }
  });
  inject(DestroyRef).onDestroy(() => {
    for (const ref of refs.values()) ref.destroy();
    refs.clear();
  });
}

export interface MutationRun<R> {
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** True while a `run(...)` async action is in flight. Mirrors the layer's `actionStatus: "running"`. */
  pending: Signal<boolean>;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * Call it in an injection context (e.g. the layer component's constructor).
 *
 * @example
 * ```ts
 * // Layer component:
 * flow = useMutationFlow(this.call);
 * save() {
 *   void this.flow.run(() => this.persist()).orEnd(true);
 * }
 * // Template: <button [disabled]="flow.pending()" (click)="save()">Confirm</button>
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  const pendingSig = signal(false);

  const run = (fn: () => Promise<void> | void): MutationRun<R> => ({
    orEnd: async (response: R) => {
      pendingSig.set(true);
      call.setRunning(true);
      try {
        await fn();
        call.end(response);
      } finally {
        call.setRunning(false);
        pendingSig.set(false);
      }
    },
  });

  return { pending: pendingSig.asReadonly(), run };
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
  states: Signal<LayerState[]>;
  stackId: string;
  /**
   * Imperatively render the child stack into a `ViewContainerRef`.
   * Must run in an injection context (delegates to {@link renderStack}).
   */
  renderInto: (vcr: ViewContainerRef) => void;
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

  inject(DestroyRef).onDestroy(() => {
    group.dispose();
    client.dismissAll(group.stackId);
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
  const renderInto = (vcr: ViewContainerRef) =>
    renderStack(vcr, stackId, undefined);

  return {
    open: open as unknown as ScopedOpen,
    dismissAll,
    states,
    stackId,
    renderInto,
  };
}

export interface AppStack {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: Signal<LayerState[]>;
}

export interface StackHook {
  provideClient: (client?: LayerClient) => FactoryProvider;
  useAppStack: () => AppStack;
  /**
   * Imperatively render the bound stack into a `ViewContainerRef`.
   * Must run in an injection context (delegates to {@link renderStack}).
   */
  renderInto: (vcr: ViewContainerRef, rootProps?: unknown) => void;
}

/** Create provider, stack access, and imperative outlet hooks bound to one stack. */
export function createStackHook(
  config: { client?: LayerClient; stack?: string } = {},
): StackHook {
  const stackId = config.stack ?? "default";

  const provideClient = (client?: LayerClient) =>
    provideLayerClient(client ?? config.client);

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

  const renderInto = (vcr: ViewContainerRef, rootProps?: unknown) =>
    renderStack(vcr, stackId, rootProps);

  return { provideClient, useAppStack, renderInto };
}
