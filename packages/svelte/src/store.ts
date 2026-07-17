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
// This entry keeps the Svelte 3+ store contract; the package root uses Svelte
// 5.7's `createSubscriber` for runes-aware reads instead.
import { getContext, onDestroy, setContext } from "svelte";
import { derived, readable, writable } from "svelte/store";
import type { Readable } from "svelte/store";

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
      "[layers/svelte-store] No LayerClient in context — call setLayerClient() in a parent component.",
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

export type WiredLayerStoreHandle<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = LayerHandle<P, R, E, D, RP> & {
  state: Readable<LayerState<P, R, E, D>[]>;
  queued: Readable<LayerState<P, R, E, D>[]>;
  top: Readable<LayerState<P, R, E, D> | null>;
};

export type WiredValidatedLayerStoreHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  state: Readable<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  queued: Readable<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  top: Readable<LayerState<InferValidatorOutput<V>, R, E, D> | null>;
};

function makeReadableStack<T>(
  stack: ReturnType<LayerClient["getStack"]>,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): Readable<T> {
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

  return readable(runSelect(getSource()), (set) => {
    const unsubscribe = stack.subscribe(() => {
      const prevValue = cache?.value;
      const next = runSelect(getSource());
      if (prevValue === undefined || !compare(prevValue, next)) {
        set(next);
      }
    });
    // Re-read on the first subscriber so an idle store cannot expose a stale
    // value.
    set(runSelect(getSource()));
    return unsubscribe;
  });
}

/**
 * Exposes a {@link LayerClient} stack as a Svelte readable store.
 *
 * Use `$stack` in components to subscribe. Pair each state with {@link callFor}
 * when rendering a layer.
 *
 * @param opts Stack id, selector, and compare options.
 * @param client Optional client override; defaults to {@link useLayerClient}.
 * @returns A readable store of the selected stack value.
 * @default `stack` is `"default"`; `select` is identity; `compare` is
 * `Object.is`.
 * @example
 * ```svelte
 * <script>
 *   import {
 *     callFor,
 *     useLayerClient,
 *     useStack,
 *   } from "@stainless-code/svelte-layers/store";
 *
 *   const client = useLayerClient();
 *   const stack = useStack({ stack: "confirm" });
 * </script>
 * {#each $stack as state (state.id)}
 *   {@const call = callFor(client, "confirm", state)}
 *   {#if call}<Confirm {call} />{/if}
 * {/each}
 * ```
 */
export function useStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Readable<T> {
  const resolved = client ?? useLayerClient();
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeReadableStack(stack, () => stack.getSnapshot(), select, compare);
}

/** Exposes a stack's queued snapshot as a Svelte readable store. */
export function createQueuedStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): Readable<T> {
  const resolved = client ?? useLayerClient();
  const stackId = opts.stack ?? "default";
  const stack = resolved.getStack(stackId);
  const select =
    opts.select ?? (defaultSelector as unknown as (states: LayerState[]) => T);
  const compare = opts.compare ?? Object.is;
  return makeReadableStack(
    stack,
    () => stack.getQueuedSnapshot(),
    select,
    compare,
  );
}

/** Observe all mounted layers matching a key. */
export function createLayerState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): Readable<U> {
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
export function createLayerQueuedState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(opts: UseLayerStateOptions<Key, P, D, U>, client?: LayerClient): Readable<U> {
  const sig = keySignature(opts.key);
  return createQueuedStack<U>(
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
): WiredLayerStoreHandle<P, R, E, D, RP> {
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
  const handle = createLayerHandle(options, resolved);
  const state = useStack(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const queued = createQueuedStack(
    { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
    resolved,
  );
  const top = derived(state, ($s) => $s.at(-1) ?? null);
  Object.assign(handle, { state, queued, top });
  return handle as WiredLayerStoreHandle<P, R, E, D, RP>;
}

/** Wired handle: wraps core {@link createLayerHandle} with store reactivity. */
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
): WiredValidatedLayerStoreHandle<V, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: NoValidateOptions<LayerOptions<P, R, E, D, RP> & { key: LayerKey }>,
  client?: LayerClient,
): WiredLayerStoreHandle<P, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerStoreHandle<P, R, E, D, RP> {
  return createLayerImpl(options, client);
}

/**
 * Builds the call context for a layer state.
 *
 * @param client Client that owns the stack.
 * @param stackId Stack containing the state.
 * @param state State whose layer should receive the call.
 * @param rootProps Props supplied by the layer host.
 * @returns The call context, or `null` if the layer is no longer mounted.
 */
export function callFor<RootProps = unknown>(
  client: LayerClient,
  stackId: string,
  state: LayerState,
  rootProps?: RootProps,
): LayerCallContext<unknown, unknown, RootProps> | null {
  const stack = client.getStack(stackId);
  const layer = stack.getLayer(state.id);
  return layer
    ? (createCallContext(stack, layer, state, rootProps) as LayerCallContext<
        unknown,
        unknown,
        RootProps
      >)
    : null;
}

export interface MutationRun<R> {
  /** On success, end the layer with `response`; on failure, leave it open and rethrow. */
  orEnd: (response: R) => Promise<void>;
}

export interface MutationFlow<R> {
  /** Store that is `true` while a `run(...)` async action is in flight; subscribe with `$pending`. Mirrors the layer's `actionStatus: "running"`. */
  pending: Readable<boolean>;
  run: (fn: () => Promise<void> | void) => MutationRun<R>;
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { type LayerComponentProps, useMutationFlow } from "@stainless-code/svelte-layers/store";
 *
 *   let { call }: LayerComponentProps<void, boolean> = $props();
 *   const { pending, run } = useMutationFlow(call);
 * </script>
 * <button disabled={$pending} onclick={() => void run(() => Promise.resolve()).orEnd(true)}>
 *   Confirm
 * </button>
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  call: LayerCallContext<P, R, RootProps>,
): MutationFlow<R> {
  const pending = writable(false);
  return {
    pending,
    run: (fn) => ({
      orEnd: async (response) => {
        pending.set(true);
        call.setRunning(true);
        try {
          await fn();
          call.end(response);
        } finally {
          call.setRunning(false);
          pending.set(false);
        }
      },
    }),
  };
}

export interface LayerGroup {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  /** The child stack store — render `{#each $stack as s}` and pair with `callFor(client, stackId, s)`. */
  stack: Readable<LayerState[]>;
  stackId: string;
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

  onDestroy(() => {
    group.dispose();
    client.dismissAll(group.stackId);
  });

  const stack = useStack({ stack: stackId });
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
