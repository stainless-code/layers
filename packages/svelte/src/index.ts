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
// This runes entry requires Svelte 5.7's `createSubscriber`; the separate
// `@stainless-code/svelte-layers/store` entry supports the store contract.
import { getContext, onDestroy, setContext } from "svelte";
import { createSubscriber } from "svelte/reactivity";

/**
 * Core headless factory — not the wired {@link createLayer}.
 * @reexport
 */
export { createLayer as createLayerHandle } from "@stainless-code/layers";
export {
  hashKey,
  keySignature,
  shallowArrayEqual,
  Subscribable,
  notifyManager,
  ControlledPromise,
  Layer,
  LayerStack,
  LayerClient,
  layerOptions,
  layerKey,
  createCallContext,
  childStackId,
  createLayerGroup,
  PayloadValidationError,
  isPayloadValidationError,
} from "@stainless-code/layers";

export type {
  Resolve,
  Reject,
  LayerHandle,
  ValidatedLayerHandle,
  LayerGroupHandle,
  LayerGroupOptions,
  DataTag,
  InferDataTagResponse,
  InferDataTagError,
  ResponseOf,
  ErrorOf,
  StandardSchemaV1,
  Validator,
  InferValidatorInput,
  InferValidatorOutput,
  OpenValidatePayload,
  ValidationIssue,
} from "@stainless-code/layers";

export type * from "@stainless-code/layers";

const LAYER_CLIENT_KEY = Symbol("layers.client");

/**
 * Provides a {@link LayerClient} to descendant components.
 *
 * @param client Client to provide. A new client is created when omitted.
 * @returns The provided client.
 */
export function setLayerClient(client?: LayerClient): LayerClient {
  const c = client ?? new LayerClient();
  setContext(LAYER_CLIENT_KEY, c);
  return c;
}

/**
 * Reads the nearest {@link LayerClient} from Svelte context.
 *
 * @returns The nearest provided client.
 */
export function useLayerClient(): LayerClient {
  const c = getContext<LayerClient | undefined>(LAYER_CLIENT_KEY);
  if (!c) {
    throw new Error(
      "[layers/svelte] No LayerClient in context — call setLayerClient() in a parent component.",
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

/** Exposes a stack through Svelte 5 runes reactivity. */
export interface SvelteStack<RootProps = unknown, T = LayerState[]> {
  /**
   * The selected stack snapshot.
   *
   * Read it inside `$derived`, `$effect`, `{#if}`, or `{#each}` to subscribe.
   */
  readonly current: T;
  /**
   * Builds the call context for a layer state.
   *
   * @param state State whose layer should receive the call.
   * @param rootProps Props supplied by the layer host.
   * @returns The call context, or `null` if the layer is no longer mounted.
   */
  callFor(
    state: LayerState,
    rootProps?: RootProps,
  ): LayerCallContext<unknown, unknown, RootProps> | null;
}

function makeSvelteStack<RootProps, T>(
  stack: ReturnType<LayerClient["getStack"]>,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): SvelteStack<RootProps, T> {
  let cache: { base: LayerState[]; value: T } | null = null;

  // Preserve selector output identity while the base snapshot is unchanged or
  // `compare` considers a new result equal, preventing object/array churn.
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

  runSelect(getSource());

  const subscribe = createSubscriber((update: () => void) =>
    stack.subscribe(() => {
      const prevValue = cache?.value;
      runSelect(getSource());
      if (prevValue === undefined || !compare(prevValue, cache!.value)) {
        update();
      }
    }),
  );

  return {
    get current() {
      subscribe();
      return runSelect(getSource());
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
  };
}

/**
 * Exposes a {@link LayerClient} stack through Svelte 5 runes reactivity.
 *
 * @param opts Stack id, selector, and compare options.
 * @param client Optional client override; defaults to {@link useLayerClient}.
 * @returns A reactive stack accessor.
 * @default `stack` is `"default"`; `select` is identity; `compare` is
 * `Object.is`.
 * @example
 * ```svelte
 * <script>
 *   import { useStack } from "@stainless-code/svelte-layers";
 *
 *   const stack = useStack({ stack: "confirm" });
 * </script>
 * {#each stack.current as state (state.id)}
 *   {@const call = stack.callFor(state)}
 *   {#if call}<Confirm {call} />{/if}
 * {/each}
 * ```
 */
export function useStack<RootProps = unknown, T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): SvelteStack<RootProps, T> {
  const resolved = client ?? useLayerClient();
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (s: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeSvelteStack(stack, () => stack.getSnapshot(), select, compare);
}

/**
 * Exposes a stack's queued snapshot through Svelte 5 runes reactivity.
 */
export function createQueuedStack<RootProps = unknown, T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): SvelteStack<RootProps, T> {
  const resolved = client ?? useLayerClient();
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (s: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeSvelteStack(
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
export function createLayerState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): SvelteStack<unknown, U> {
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
): SvelteStack<unknown, U> {
  const sig = keySignature(opts.key);
  return createQueuedStack<unknown, U>(
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
  const stateObs = useStack<RP, LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const queuedObs = createQueuedStack<RP, LayerState<P, R, E, D>[]>(
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

/** Wired handle: wraps core {@link createLayerHandle} with runes reactivity. */
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
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /**
   * True while a `run(...)` async action is in flight. Read it in markup or
   * `$derived` to subscribe. Mirrors the layer's `actionStatus: "running"`.
   */
  readonly pending: boolean;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { type LayerComponentProps, useMutationFlow } from "@stainless-code/svelte-layers";
 *
 *   let { call }: LayerComponentProps<void, boolean> = $props();
 *   const flow = useMutationFlow(call);
 * </script>
 * <button
 *   disabled={flow.pending}
 *   onclick={() => void flow.run(() => Promise.resolve()).orEnd(true)}
 * >
 *   Confirm
 * </button>
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  // `pending` stays reactive without `$state` (this is a plain `.ts` module):
  // reads register via `createSubscriber`, and `notify()` on each toggle
  // invalidates subscribers — the same pattern as `useStack().current`.
  let pending = false;
  let notify: (() => void) | null = null;
  const subscribe = createSubscriber((update) => {
    notify = update;
    return () => {
      notify = null;
    };
  });
  return {
    get pending() {
      subscribe();
      return pending;
    },
    run: (fn) => ({
      orEnd: async (response) => {
        pending = true;
        notify?.();
        call.setRunning(true);
        try {
          await fn();
          call.end(response);
        } finally {
          call.setRunning(false);
          pending = false;
          notify?.();
        }
      },
    }),
  };
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

export interface LayerGroup<RootProps = unknown> {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  /** The child stack — render with `{#each group.stack.current as s}` + `group.stack.callFor(s)`. */
  stack: SvelteStack<RootProps>;
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
): LayerGroup<RootProps> {
  const client = useLayerClient();
  const stackId = childStackId(call, options?.name);
  const group = createLayerGroup(client, call, options);

  onDestroy(() => {
    group.dispose();
    client.dismissAll(group.stackId);
  });

  const stack = useStack<RootProps>({ stack: stackId });
  const open = (<
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
    } as OpenLayerOptions<P2, R2, E, D, RP>)) as unknown as ScopedOpen;
  const dismissAll = (response?: unknown) =>
    client.dismissAll(stackId, response);

  return { open, dismissAll, stack, stackId };
}

export type { LayerComponentProps };
