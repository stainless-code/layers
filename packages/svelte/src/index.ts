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
// This runes entry requires Svelte 5.7's `createSubscriber`; the separate
// `@stainless-code/svelte-layers/store` entry supports the store contract.
import { getContext, onDestroy, setContext } from "svelte";
import { createSubscriber } from "svelte/reactivity";

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

export * from "@stainless-code/layers";

function defaultSelector(states: LayerState[]): LayerState[] {
  return states;
}

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

/**
 * Exposes a {@link LayerClient} stack through Svelte 5 runes reactivity.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param stackId Stack to observe.
 * @param selector Derives the exposed value from the stack snapshot.
 * @param compare Determines whether a selected value changed.
 * @returns A reactive stack accessor.
 * @default `stackId` is `"default"`; `selector` is identity; `compare` is
 * `Object.is`.
 * @example
 * ```svelte
 * <script>
 *   import { useStack } from "@stainless-code/svelte-layers";
 *
 *   const stack = useStack("confirm");
 * </script>
 * {#each stack.current as state (state.id)}
 *   {@const call = stack.callFor(state)}
 *   {#if call}<Confirm {call} />{/if}
 * {/each}
 * ```
 */
export function useStack<RootProps = unknown, T = LayerState[]>(
  client: LayerClient,
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): SvelteStack<RootProps, T>;
export function useStack<RootProps = unknown, T = LayerState[]>(
  stackId?: string,
  selector?: (states: LayerState[]) => T,
  compare?: (a: T, b: T) => boolean,
): SvelteStack<RootProps, T>;
export function useStack<RootProps = unknown, T = LayerState[]>(
  clientOrStackId?: LayerClient | string,
  stackIdOrSelector?: string | ((states: LayerState[]) => T),
  selectorOrCompare?: ((states: LayerState[]) => T) | ((a: T, b: T) => boolean),
  compareArg?: (a: T, b: T) => boolean,
): SvelteStack<RootProps, T> {
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

  select(stack.getSnapshot());

  const subscribe = createSubscriber((update: () => void) =>
    stack.subscribe(() => {
      const prevValue = cache?.value;
      select(stack.getSnapshot());
      if (prevValue === undefined || !compare(prevValue, cache!.value)) {
        update();
      }
    }),
  );
  return {
    get current() {
      subscribe();
      return select(stack.getSnapshot());
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
 * Exposes one active layer through Svelte 5 runes reactivity.
 *
 * @param client Client to observe. Omit it to use {@link useLayerClient}.
 * @param key Layer key to match.
 * @param stackId Stack to search.
 * @param compare Determines whether the matched state changed.
 * @returns A reactive accessor whose `current` is `null` while inactive.
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
): SvelteStack<unknown, LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
export function useLayer<Key extends LayerKey, P = unknown, D = unknown>(
  key: Key,
  stackId?: string,
  compare?: (
    a: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
    b: LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null,
  ) => boolean,
): SvelteStack<unknown, LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null>;
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
): SvelteStack<
  unknown,
  LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null
> {
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
  ) as SvelteStack<
    unknown,
    LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D> | null
  >;
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

  const stack = useStack<RootProps>(client, stackId);
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
