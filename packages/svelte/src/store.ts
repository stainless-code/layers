import type {
  DataTag,
  DefaultLayerError,
  ErrorOf,
  LayerCallContext,
  LayerComponentProps,
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
// This entry keeps the Svelte 3+ store contract; the package root uses Svelte
// 5.7's `createSubscriber` for runes-aware reads instead.
import { getContext, onDestroy, setContext } from "svelte";
import { readable, writable } from "svelte/store";
import type { Readable } from "svelte/store";

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

export * from "@stainless-code/layers";

function defaultSelector(states: LayerState[]): LayerState[] {
  return states;
}

/**
 * Exposes a {@link LayerClient} stack as a Svelte readable store.
 *
 * Use `$stack` in components to subscribe. Pair each state with {@link callFor}
 * when rendering a layer.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param stackId Stack to observe.
 * @param selector Derives the store value from the stack snapshot.
 * @param compare Determines whether a selected value changed.
 * @returns A readable store of the selected stack value.
 * @default `stackId` is `"default"`; `selector` is identity; `compare` is
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
 *   const stack = useStack(client, "confirm");
 * </script>
 * {#each $stack as state (state.id)}
 *   {@const call = callFor(client, "confirm", state)}
 *   {#if call}<Confirm {call} />{/if}
 * {/each}
 * ```
 */
export function useStack<T = LayerState[]>(
  client: LayerClient,
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Readable<T>;
export function useStack<T = LayerState[]>(
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): Readable<T>;
export function useStack<T = LayerState[]>(
  clientOrStackId?: LayerClient | string,
  stackIdOrSelector?: string | ((states: LayerState[]) => T),
  selectorOrCompare?: ((states: LayerState[]) => T) | ((a: T, b: T) => boolean),
  compareArg?: (a: T, b: T) => boolean,
): Readable<T> {
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

  return readable(select(stack.getSnapshot()), (set) => {
    const unsubscribe = stack.subscribe(() => {
      const prevValue = cache?.value;
      const next = select(stack.getSnapshot());
      if (prevValue === undefined || !compare(prevValue, next)) {
        set(next);
      }
    });
    // Re-read on the first subscriber so an idle store cannot expose a stale
    // value.
    set(select(stack.getSnapshot()));
    return unsubscribe;
  });
}

/**
 * Exposes one active layer as a Svelte readable store.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param key Layer key to match.
 * @param stackId Stack to search.
 * @param compare Determines whether the matched state changed.
 * @returns A readable store that yields `null` while the layer is inactive.
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
): Readable<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): Readable<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
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
): Readable<LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null> {
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
  );
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
  /** The child stack store — render `{#each $stack as s}` and pair with `callFor(client, stackId, s)`. */
  stack: Readable<LayerState[]>;
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

  onDestroy(() => {
    group.dispose();
    client.dismissAll(group.stackId);
  });

  const stack = useStack(client, stackId);
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
