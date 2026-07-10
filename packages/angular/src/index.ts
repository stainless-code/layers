import {
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
  LayerCallContext,
  LayerGroupOptions,
  LayerKey,
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

/**
 * Bridges a {@link LayerClient} stack into an Angular `Signal`.
 * Must run in an injection context because the subscription uses `effect()`.
 *
 * @param stackId - Stack to observe.
 * @param selector - Derives the value exposed by the signal.
 * @param compare - Prevents updates when selected values are equal.
 * @returns A readonly `Signal` containing the selected stack value.
 * @default stackId `"default"`; compare `Object.is`.
 */
export function useStack<T = LayerState[]>(
  client: LayerClient,
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Signal<T>;
export function useStack<T = LayerState[]>(
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Signal<T>;
export function useStack<T = LayerState[]>(
  clientOrStackId?: LayerClient | string,
  stackIdOrSelector?: string | ((states: LayerState[]) => T),
  selectorOrCompare?: ((states: LayerState[]) => T) | ((a: T, b: T) => boolean),
  compareArg?: (a: T, b: T) => boolean,
): Signal<T> {
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

  const state = signal<T>(select(stack.getSnapshot()));
  effect((onCleanup) => {
    // `effect()` runs after the current change-detection cycle, so a stack
    // mutation between signal creation and effect attach would leave the
    // signal stale. Re-read at attach time to close that gap.
    state.set(select(stack.getSnapshot()));
    const unsubscribe = stack.subscribe(() => {
      const prev = state();
      const next = select(stack.getSnapshot());
      if (!compare(prev, next)) {
        state.set(next);
      }
    });
    onCleanup(unsubscribe);
  });
  return state.asReadonly();
}

/** Observes one active layer by key as a readonly `Signal`, or `null` when inactive. */
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  client: LayerClient,
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Signal<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Signal<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
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
): Signal<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null> {
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
  ) as Signal<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
}

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
  const states = useStack(stackId);
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
  const states = useStack(stackId);
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

  const renderInto = (vcr: ViewContainerRef, rootProps?: unknown) =>
    renderStack(vcr, stackId, rootProps);

  return { provideClient, useAppStack, renderInto };
}
