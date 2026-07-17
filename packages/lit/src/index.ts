import { ContextConsumer, ContextProvider, createContext } from "@lit/context";
import type { Context } from "@lit/context";
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
import { LitElement, nothing } from "lit";
import type {
  PropertyValues,
  ReactiveController,
  ReactiveControllerHost,
  TemplateResult,
} from "lit";
import { html } from "lit";
import { directive } from "lit/directive.js";
import { Directive } from "lit/directive.js";
import { repeat } from "lit/directives/repeat.js";

export * from "@stainless-code/layers";

/** @lit/context key carrying the nearest {@link LayerClient}. */
export const layerClientContext: Context<string, LayerClient> = createContext<
  LayerClient,
  string
>("layers-client");

type LitControllerHost = ReactiveControllerHost & HTMLElement;
type ClientConsumer = ContextConsumer<
  Context<string, LayerClient>,
  LitControllerHost
>;

function isElementHost(
  host: ReactiveControllerHost,
): host is LitControllerHost {
  return (
    typeof (host as Partial<HTMLElement>).addEventListener === "function" &&
    typeof (host as Partial<HTMLElement>).dispatchEvent === "function"
  );
}

/**
 * Provides a {@link LayerClient} to descendant consumers via `@lit/context`.
 *
 * Attaches a {@link ContextProvider} to `host`; descendants resolve it with
 * {@link useLayerClient} or by omitting `client` on a hook. A new client is
 * created when `client` is omitted.
 *
 * @param host Lit element host that owns the context provider.
 * @param client Optional client to provide; a new {@link LayerClient} is created when omitted.
 * @returns The provided client.
 */
export function provideLayerClient(
  host: LitControllerHost,
  client?: LayerClient,
): LayerClient {
  const c = client ?? new LayerClient();
  new ContextProvider(host, { context: layerClientContext, initialValue: c });
  return c;
}

/**
 * Reactive controller that resolves the nearest {@link LayerClient} from
 * `@lit/context` and exposes it via {@link LayerClientConsumer.current}.
 *
 * The value is undefined until the host connects under a provider; `.current`
 * throws when accessed before a client is available.
 */
export class LayerClientConsumer implements ReactiveController {
  #consumer: ClientConsumer;
  #client: LayerClient | undefined;

  constructor(host: LitControllerHost) {
    this.#consumer = new ContextConsumer(host, {
      context: layerClientContext,
      subscribe: true,
      callback: (c: LayerClient) => {
        this.#client = c;
      },
    });
    host.addController(this);
  }

  hostConnected(): void {
    if (this.#consumer.value !== undefined) {
      this.#client = this.#consumer.value as LayerClient;
    }
  }

  hostDisconnected(): void {}

  /** The resolved client; throws when no provider has supplied one yet. */
  get current(): LayerClient {
    const c = this.#client ?? (this.#consumer.value as LayerClient | undefined);
    if (!c) {
      throw new Error(
        "[layers/lit] No LayerClient in context — wrap your tree with provideLayerClient() / <stack-provider> or pass `client` explicitly.",
      );
    }
    return c;
  }
}

/**
 * Resolve the nearest {@link LayerClient} from `@lit/context`.
 *
 * Returns a {@link LayerClientConsumer} controller; read the client via
 * `.current` (throws when no provider has supplied one yet). Prefer passing
 * `client` explicitly on `useStack` / `useLayer` for synchronous access at
 * construction time — context only resolves once the host is connected.
 *
 * @returns A {@link LayerClientConsumer} controller; read `.current` for the client.
 */
export function useLayerClient(host: LitControllerHost): LayerClientConsumer {
  return new LayerClientConsumer(host);
}

/**
 * Lazy {@link LayerClient} resolver. Returns a handle whose `.get()` yields the
 * client once it is supplied — synchronously when `client` is passed, or after
 * the host connects under a `provideLayerClient()` ancestor via `@lit/context`.
 *
 * `onResolved` fires once with the resolved client (synchronously for an
 * explicit client, asynchronously on context callback otherwise) so callers
 * that need to react (subscribe, build a handle) can. Throws synchronously when
 * no client is supplied and `host` is not an element host context can resolve
 * on; `.get()` throws when accessed before context has supplied a client.
 */
function resolveClientLazy(
  host: ReactiveControllerHost,
  client: LayerClient | undefined,
  onResolved?: (client: LayerClient) => void,
): { get(): LayerClient } {
  if (client) {
    onResolved?.(client);
    return { get: () => client };
  }
  if (!isElementHost(host)) {
    throw new Error(
      "[layers/lit] No LayerClient — pass `client` on the options bag, wrap your tree with provideLayerClient() / <stack-provider>, or use a LitElement host so context can resolve.",
    );
  }
  let resolved: LayerClient | undefined;
  new ContextConsumer(host, {
    context: layerClientContext,
    subscribe: true,
    callback: (c: LayerClient) => {
      resolved = c;
      onResolved?.(c);
    },
  });
  return {
    get() {
      if (!resolved) {
        throw new Error(
          "[layers/lit] LayerClient not resolved yet — access after the host connects under a provideLayerClient() ancestor, or pass `client` explicitly.",
        );
      }
      return resolved;
    },
  };
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
  client?: LayerClient;
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

function createSnapshotSelector<T>(
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): { runSelect: (base: LayerState[]) => T } {
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

  return { runSelect };
}

/**
 * Shared snapshot subscription primitive for stack controllers.
 *
 * Selector output is memoized against the stable snapshot reference so hosts
 * do not churn object or array selections.
 */
function subscribeStackSnapshot<T>(
  host: ReactiveControllerHost,
  stack: LayerStack,
  getSource: () => LayerState[],
  select: (states: LayerState[]) => T,
  compare: (a: T, b: T) => boolean,
): { get value(): T; unsubscribe(): void } {
  const { runSelect } = createSnapshotSelector(select, compare);
  let current = runSelect(getSource());

  const unsubscribe = stack.subscribe(() => {
    const prev = current;
    const next = runSelect(getSource());
    if (!compare(prev, next)) {
      current = next;
      host.requestUpdate();
    }
  });

  return {
    get value() {
      return current;
    },
    unsubscribe,
  };
}

const warnedMissingComponent = new Set<string>();

function warnMissingLayerComponent(id: string, key: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const sig = `${id}:${JSON.stringify(key)}`;
  if (warnedMissingComponent.has(sig)) return;
  warnedMissingComponent.add(sig);
  console.warn(
    `[layers/lit] No component for layer ${id} (key ${JSON.stringify(key)}); StackOutlet renders nothing. Provide a \`component\` or use useStackHandles.`,
  );
}

/** Reactive controller that mirrors a {@link LayerClient} stack snapshot. */
export class StackController<T = LayerState[]> implements ReactiveController {
  #host: ReactiveControllerHost;
  #snapshot: ReturnType<typeof subscribeStackSnapshot<T>> | null = null;
  #getSource: (() => LayerState[]) | null = null;
  #select: (states: LayerState[]) => T;
  #compare: (a: T, b: T) => boolean;
  #stack: LayerStack | null = null;
  #client: LayerClient | undefined;
  #stackId = "default";
  #initial: T;
  #queued: boolean;
  #connected = false;

  constructor(
    host: ReactiveControllerHost,
    options: UseStackOptions<T> = {},
    client?: LayerClient,
    queued = false,
    deferClient = false,
  ) {
    this.#host = host;
    this.#queued = queued;
    this.#select =
      options.select ??
      (defaultSelector as unknown as (states: LayerState[]) => T);
    this.#compare = options.compare ?? Object.is;
    // Sensible empty selection before a client resolves (lazy context path):
    // `[]` for the default selector, `select([])` otherwise.
    this.#initial = this.#select([]);

    this.#stackId = options.stack ?? "default";
    if (!deferClient) {
      resolveClientLazy(host, client ?? options.client, (c) => {
        if (this.#stack === null) {
          this.#initStack(c, this.#stackId);
          if (this.#connected) this.#setup();
        }
      });
    }
    host.addController(this);
  }

  /**
   * Bind a {@link LayerClient} when constructed with `deferClient` (internal:
   * {@link LayerController} shares one lazy context resolve across its stacks).
   */
  bindClient(client: LayerClient): void {
    if (this.#stack !== null) {
      if (this.#client === client) return;
      this.reconfigure({}, client);
      return;
    }
    this.#initStack(client, this.#stackId);
    if (this.#connected) {
      this.#setup();
    }
  }

  /**
   * Tear down the current subscription, apply new options, and re-subscribe when
   * the host is connected.
   */
  reconfigure(options: UseStackOptions<T> = {}, client?: LayerClient): void {
    this.#snapshot?.unsubscribe();
    this.#snapshot = null;
    this.#stack = null;
    this.#getSource = null;

    if (options.select !== undefined) {
      this.#select = options.select;
    }
    if (options.compare !== undefined) {
      this.#compare = options.compare;
    }
    const stackId = options.stack ?? this.#stackId;
    this.#stackId = stackId;

    const c = client ?? options.client ?? this.#client;
    if (!c) {
      this.#initial = this.#select([]);
      this.#host.requestUpdate();
      return;
    }

    this.#initStack(c, stackId);
    if (this.#connected) {
      this.#setup();
    }
    this.#host.requestUpdate();
  }

  #initStack(client: LayerClient, stackId: string): void {
    this.#client = client;
    this.#stackId = stackId;
    this.#stack = client.getStack(stackId);
    this.#getSource = this.#queued
      ? () => this.#stack!.getQueuedSnapshot()
      : () => this.#stack!.getSnapshot();
    const { runSelect } = createSnapshotSelector(this.#select, this.#compare);
    this.#initial = runSelect(this.#getSource());
  }

  #setup(): void {
    if (this.#stack === null || this.#getSource === null) return;
    this.#snapshot = subscribeStackSnapshot(
      this.#host,
      this.#stack,
      this.#getSource,
      this.#select,
      this.#compare,
    );
    const synced = this.#snapshot.value;
    if (!this.#compare(this.#initial, synced)) {
      this.#initial = synced;
      this.#host.requestUpdate();
    }
  }

  hostConnected(): void {
    this.#connected = true;
    if (this.#stack !== null) {
      this.#setup();
    }
  }

  hostDisconnected(): void {
    this.#connected = false;
    this.#snapshot?.unsubscribe();
    this.#snapshot = null;
  }

  /** Selected stack value; updates when the stack publishes a new snapshot. */
  get current(): T {
    return this.#snapshot?.value ?? this.#initial;
  }
}

/**
 * Subscribe a Lit host to a {@link LayerClient} stack via {@link StackController}.
 *
 * @param host Reactive controller host (typically `this` on a `LitElement`).
 * @param opts `stack`, `select`, `compare`, and optional `client`.
 * @param client Client to observe when not passed on `opts`.
 * @returns A {@link StackController} whose `.current` mirrors the selected snapshot.
 * @default opts.stack `"default"`
 * @default opts.select all mounted states (identity)
 * @default opts.compare `Object.is`
 */
export function useStack<T = LayerState[]>(
  host: ReactiveControllerHost,
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): StackController<T> {
  return new StackController(host, opts, client, false);
}

/** Reactive controller that mirrors a stack's queued snapshot. */
export function useQueuedStack<T = LayerState[]>(
  host: ReactiveControllerHost,
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): StackController<T> {
  return new StackController(host, opts, client, true);
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
  host: ReactiveControllerHost,
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): StackController<U> {
  const sig = keySignature(opts.key);
  return useStack<U>(host, {
    stack: opts.stack,
    select: (states) => {
      const filtered = states.filter(
        (s) => keySignature(s.key) === sig,
      ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
      return opts.select ? opts.select(filtered) : (filtered as unknown as U);
    },
    compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
    client,
  });
}

/** Observe all queued layers matching a key. */
export function useLayerQueuedState<
  Key extends LayerKey,
  P = unknown,
  D = unknown,
  U = LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[],
>(
  host: ReactiveControllerHost,
  opts: UseLayerStateOptions<Key, P, D, U>,
  client?: LayerClient,
): StackController<U> {
  const sig = keySignature(opts.key);
  return useQueuedStack<U>(host, {
    stack: opts.stack,
    select: (states) => {
      const filtered = states.filter(
        (s) => keySignature(s.key) === sig,
      ) as LayerState<P, ResponseOf<Key>, ErrorOf<Key>, D>[];
      return opts.select ? opts.select(filtered) : (filtered as unknown as U);
    },
    compare: opts.compare ?? (shallowArrayEqual as (a: U, b: U) => boolean),
    client,
  });
}

export type WiredLayerHandle<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = LayerHandle<P, R, E, D, RP> & {
  state: StackController<LayerState<P, R, E, D>[]>;
  queued: StackController<LayerState<P, R, E, D>[]>;
  top: LayerState<P, R, E, D> | null;
};

export type WiredValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> = ValidatedLayerHandle<V, R, E, D, RP> & {
  state: StackController<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  queued: StackController<LayerState<InferValidatorOutput<V>, R, E, D>[]>;
  top: LayerState<InferValidatorOutput<V>, R, E, D> | null;
};

/**
 * Reactive controller wiring `createLayer` with reactive `state` / `queued` /
 * `top` for a single layer key.
 */
export class LayerController<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
> implements ReactiveController {
  #options: LayerOptions<P, R, E, D, RP> & { key: LayerKey };
  #state: StackController<LayerState<P, R, E, D>[]>;
  #queued: StackController<LayerState<P, R, E, D>[]>;
  #client: { get(): LayerClient };
  #handle: LayerHandle<P, R, E, D, RP> | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
    client?: LayerClient,
  ) {
    this.#options = options;
    const stackId = options.stack ?? "default";
    const sig = keySignature(options.key);
    const selectByKey = (states: LayerState[]) =>
      states.filter((s) => keySignature(s.key) === sig) as LayerState<
        P,
        R,
        E,
        D
      >[];
    const deferClient = !client;
    this.#state = new StackController<LayerState<P, R, E, D>[]>(
      host,
      { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
      client,
      false,
      deferClient,
    );
    this.#queued = new StackController<LayerState<P, R, E, D>[]>(
      host,
      { stack: stackId, select: selectByKey, compare: shallowArrayEqual },
      client,
      true,
      deferClient,
    );
    // `createLayer` needs a client synchronously; defer it until the client is
    // resolved (explicit, or from context after the host connects). The handle
    // is built lazily on first method access or in `hostConnected`.
    this.#client = resolveClientLazy(host, client, (c) => {
      this.#state.bindClient(c);
      this.#queued.bindClient(c);
    });
    host.addController(this);
  }

  /** Lazily build the wired handle once the client is available. */
  #getHandle(): LayerHandle<P, R, E, D, RP> {
    if (this.#handle === null) {
      this.#handle = createLayer(this.#options, this.#client.get());
    }
    return this.#handle;
  }

  hostConnected(): void {
    // Eagerly build the handle if context already resolved; otherwise defer to
    // first method access (`.open` / `.current` throw until then).
    try {
      this.#getHandle();
    } catch {
      /* client not resolved yet — built on first access */
    }
  }
  hostDisconnected(): void {}

  get open(): LayerHandle<P, R, E, D, RP>["open"] {
    return this.#getHandle().open;
  }
  get upsert(): LayerHandle<P, R, E, D, RP>["upsert"] {
    return this.#getHandle().upsert;
  }
  get dismiss(): LayerHandle<P, R, E, D, RP>["dismiss"] {
    return this.#getHandle().dismiss;
  }
  get update(): LayerHandle<P, R, E, D, RP>["update"] {
    return this.#getHandle().update;
  }
  get cancelQueued(): LayerHandle<P, R, E, D, RP>["cancelQueued"] {
    return this.#getHandle().cancelQueued;
  }
  get client(): LayerHandle<P, R, E, D, RP>["client"] {
    return this.#getHandle().client;
  }
  get stack(): LayerHandle<P, R, E, D, RP>["stack"] {
    return this.#getHandle().stack;
  }
  get options(): LayerHandle<P, R, E, D, RP>["options"] {
    return this.#getHandle().options;
  }
  get current(): LayerHandle<P, R, E, D, RP>["current"] {
    return this.#getHandle().current;
  }
  get state(): StackController<LayerState<P, R, E, D>[]> {
    return this.#state;
  }
  get queued(): StackController<LayerState<P, R, E, D>[]> {
    return this.#queued;
  }
  get top(): LayerState<P, R, E, D> | null {
    return this.#state.current.at(-1) ?? null;
  }
}

/** Wired handle: `createLayer` + reactive `state`/`queued`/`top`. */
export function useLayer<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  host: ReactiveControllerHost,
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
  host: ReactiveControllerHost,
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
  host: ReactiveControllerHost,
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client?: LayerClient,
): WiredLayerHandle<P, R, E, D, RP> {
  return new LayerController(
    host,
    options,
    client,
  ) as unknown as WiredLayerHandle<P, R, E, D, RP>;
}

export interface StackHandles {
  states: StackController<LayerState[]>;
  getCall: (state: LayerState) => LayerCallContext<unknown, unknown>;
}

/**
 * Reactive controller exposing the states and call contexts needed to render
 * a stack headlessly (without `StackOutlet`).
 */
export class StackHandlesController implements ReactiveController {
  #states: StackController<LayerState[]>;
  #stack: LayerStack | null = null;
  #rootProps: unknown;
  #stackId: string;

  constructor(
    host: ReactiveControllerHost,
    stack = "default",
    rootProps?: unknown,
    client?: LayerClient,
  ) {
    this.#stackId = stack;
    this.#rootProps = rootProps;
    this.#states = new StackController(
      host,
      { stack, client },
      undefined,
      false,
    );
    if (client) {
      this.#initStack(client);
    } else if (isElementHost(host)) {
      new ContextConsumer(host, {
        context: layerClientContext,
        subscribe: true,
        callback: (c: LayerClient) => {
          this.#initStack(c);
        },
      });
    } else {
      throw new Error(
        "[layers/lit] useStackHandles needs an explicit `client` or a LitElement host so context can resolve.",
      );
    }
    host.addController(this);
  }

  #initStack(client: LayerClient): void {
    this.#stack = client.getStack(this.#stackId);
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  get states() {
    return this.#states;
  }

  getCall = (state: LayerState): LayerCallContext<unknown, unknown> => {
    if (this.#stack === null) {
      throw new Error(
        "[layers/lit] useStackHandles: LayerClient not resolved yet — access getCall after the host connects.",
      );
    }
    return createCallContext(
      this.#stack,
      this.#stack.getLayer(state.id)!,
      state,
      this.#rootProps,
    ) as LayerCallContext<unknown, unknown>;
  };
}

/** Return the states and call contexts needed to render a stack headlessly. */
export function useStackHandles(
  host: ReactiveControllerHost,
  stack = "default",
  rootProps?: unknown,
  client?: LayerClient,
): StackHandlesController {
  return new StackHandlesController(host, stack, rootProps, client);
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
 * Reactive controller coordinating a layer's pending state with an async
 * mutation and ending it on success.
 */
export class MutationFlowController<R> implements ReactiveController {
  #host: ReactiveControllerHost;
  #call: LayerCallContext<unknown, R>;
  #pending = false;

  constructor(
    host: ReactiveControllerHost,
    call: LayerCallContext<unknown, R>,
  ) {
    this.#host = host;
    this.#call = call;
    host.addController(this);
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  get pending(): boolean {
    return this.#pending;
  }

  run = (fn: () => Promise<void> | void): MutationRun<R> => ({
    orEnd: async (response: R) => {
      this.#pending = true;
      this.#host.requestUpdate();
      this.#call.setRunning(true);
      try {
        await fn();
        this.#call.end(response);
      } finally {
        this.#call.setRunning(false);
        this.#pending = false;
        this.#host.requestUpdate();
      }
    },
  });
}

/**
 * Coordinate a layer's pending state with an async mutation and end it on success.
 *
 * @example
 * ```ts
 * @customElement("confirm-dialog")
 * class ConfirmDialog extends LitElement {
 *   @property({ attribute: false }) call!: LayerCallContext<void, boolean>;
 *   #flow = new MutationFlowController(this, this.call);
 *   render() {
 *     return html`<button @click=${() => this.#flow.run(async () => {}).orEnd(true)}>Yes</button>`;
 *   }
 * }
 * ```
 */
export function useMutationFlow<P, R, RootProps = unknown>(
  host: ReactiveControllerHost,
  call: LayerCallContext<P, R, RootProps>,
): MutationFlowController<R> {
  return new MutationFlowController(host, call as LayerCallContext<unknown, R>);
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
  states: StackController<LayerState[]>;
  /** Renders the child stack inline — place inside the parent layer's DOM. */
  outlet: (rootProps?: unknown) => TemplateResult;
  stackId: string;
}

/**
 * Reactive controller for a child stack scoped to the calling layer's lifetime.
 *
 * The child stack is disposed and dismissed when its parent layer unmounts.
 * {@link LayerGroupController.outlet} returns a `TemplateResult` that renders the
 * child stack inline (router `Routes.outlet()`-shaped) — share the render helper
 * with `StackOutlet`.
 */
export class LayerGroupController<
  P,
  R,
  RootProps = unknown,
> implements ReactiveController {
  #client: LayerClient | undefined;
  #group: ReturnType<typeof createLayerGroup> | null = null;
  #states: StackController<LayerState[]>;
  #stackId: string;
  #rootProps: RootProps;
  #call: LayerCallContext<P, R, RootProps>;
  #options: LayerGroupOptions | undefined;

  constructor(
    host: ReactiveControllerHost,
    call: LayerCallContext<P, R, RootProps>,
    options?: LayerGroupOptions,
    client?: LayerClient,
  ) {
    this.#call = call;
    this.#options = options;
    this.#rootProps = call.root;
    this.#stackId = childStackId(call, options?.name);

    if (client) {
      this.#init(client);
    } else if (isElementHost(host)) {
      new ContextConsumer(host, {
        context: layerClientContext,
        subscribe: true,
        callback: (c: LayerClient) => {
          if (this.#group === null) this.#init(c);
        },
      });
    } else {
      throw new Error(
        "[layers/lit] useLayerGroup needs an explicit `client` or a LitElement host so context can resolve.",
      );
    }
    this.#states = new StackController(
      host,
      { stack: this.#stackId, client: this.#client },
      undefined,
      false,
    );
    host.addController(this);
  }

  #init(client: LayerClient): void {
    this.#client = client;
    this.#group = createLayerGroup(client, this.#call, this.#options);
  }

  hostConnected(): void {}
  hostDisconnected(): void {
    this.#group?.dispose();
    this.#client?.dismissAll(this.#stackId);
  }

  get stackId(): string {
    return this.#stackId;
  }

  get states(): StackController<LayerState[]> {
    return this.#states;
  }

  open = (<P2, R2 = void, E = DefaultLayerError, D = unknown, RP = unknown>(
    opts: OmitKeyof<OpenLayerOptions<P2, R2, E, D, RP>, "stack">,
  ) => {
    if (!this.#client) {
      throw new Error(
        "[layers/lit] useLayerGroup: LayerClient not resolved yet — call open() after the host connects.",
      );
    }
    return this.#client.open({
      ...opts,
      stack: this.#stackId,
    } as OpenLayerOptions<P2, R2, E, D, RP>);
  }) as unknown as ScopedOpen;

  dismissAll = (response?: unknown): void => {
    this.#client?.dismissAll(this.#stackId, response);
  };

  outlet = (rootProps?: unknown): TemplateResult => {
    if (!this.#client) return html``;
    return renderStack(
      this.#client,
      this.#stackId,
      rootProps ?? this.#rootProps,
    );
  };
}

/**
 * Create a child stack scoped to the calling layer's lifetime.
 *
 * The child stack is disposed and dismissed when its parent layer unmounts.
 */
export function useLayerGroup<P, R, RootProps = unknown>(
  host: ReactiveControllerHost,
  call: LayerCallContext<P, R, RootProps>,
  options?: LayerGroupOptions,
  client?: LayerClient,
): LayerGroup {
  const controller = new LayerGroupController(host, call, options, client);
  return {
    open: controller.open,
    dismissAll: controller.dismissAll,
    states: controller.states,
    outlet: controller.outlet,
    stackId: controller.stackId,
  };
}

/** A layer component is either a `LitElement` constructor or a render function. */
export type LitLayerComponent =
  | (new () => LitElement)
  | ((props: LayerComponentProps) => TemplateResult);

function isLitElementCtor(c: unknown): c is new () => LitElement {
  return typeof c === "function" && c.prototype instanceof LitElement;
}

interface LayerElementProps {
  call: LayerCallContext<unknown, unknown>;
  payload: unknown;
  data: unknown;
  error: unknown;
  phase: unknown;
  transition: unknown;
  dismissing: unknown;
  actionStatus: unknown;
}

/**
 * Directive that instantiates a `LitElement` layer component once and updates
 * its reactive properties in place across renders. Pair with id-keyed `repeat`
 * so each layer keeps its element instance (no remount on prop churn).
 *
 * Lit 3 forbids dynamic tag bindings (`html`<${Ctor}>``), so we construct the
 * element imperatively and render the node.
 */
class LayerElementDirective extends Directive {
  #el: LitElement | null = null;

  render(ctor: new () => LitElement, props: LayerElementProps): LitElement {
    if (this.#el === null) {
      this.#el = new ctor();
    }
    const el = this.#el as LitElement & Record<string, unknown>;
    el.call = props.call;
    el.payload = props.payload;
    el.data = props.data;
    el.error = props.error;
    el.phase = props.phase;
    el.transition = props.transition;
    el.dismissing = props.dismissing;
    el.actionStatus = props.actionStatus;
    return this.#el;
  }
}

const layerElement = directive(LayerElementDirective);

function renderLayer(
  component: LitLayerComponent,
  call: LayerCallContext<unknown, unknown>,
  state: LayerState,
): TemplateResult | typeof nothing {
  if (isLitElementCtor(component)) {
    return html`${layerElement(component, {
      call,
      payload: state.payload,
      data: state.data,
      error: state.error,
      phase: state.phase,
      transition: state.transition,
      dismissing: state.dismissing,
      actionStatus: state.actionStatus,
    })}`;
  }
  return (component as (props: LayerComponentProps) => TemplateResult)({
    call: call as never,
    payload: state.payload as never,
    data: state.data as never,
    error: state.error as never,
    phase: state.phase,
    transition: state.transition,
    dismissing: state.dismissing,
    actionStatus: state.actionStatus,
  });
}

/**
 * Render every active layer in a stack with its registered component.
 *
 * Shared by {@link StackOutlet} and {@link LayerGroupController.outlet}. Keys by
 * `state.id` so prop changes update in place without recreating instances.
 */
function renderStack(
  client: LayerClient,
  stackId: string,
  rootProps?: unknown,
): TemplateResult {
  const stack = client.getStack(stackId);
  const states = stack.getSnapshot();
  return html`${repeat(
    states,
    (s) => s.id,
    (s) => {
      const layer = stack.getLayer(s.id);
      const component = layer?.component as LitLayerComponent | undefined;
      if (!layer || !component) {
        warnMissingLayerComponent(s.id, s.key);
        return nothing;
      }
      const call = createCallContext(
        stack,
        layer,
        s,
        rootProps,
      ) as LayerCallContext<unknown, unknown>;
      return renderLayer(component, call, s);
    },
  )}`;
}

/**
 * `<stack-provider>` — provides a {@link LayerClient} via `@lit/context`.
 * Shadow root + `<slot>`; composed `context-request` still reaches light children.
 *
 * Register with {@link defineStackElements}. Omitting `.client` creates one.
 */
export class StackProvider extends LitElement {
  static properties = {
    client: { attribute: false },
  };
  declare client: LayerClient | undefined;
  #provider: ContextProvider<Context<string, LayerClient>, this> | null = null;

  constructor() {
    super();
    this.client = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.#provider === null) {
      const c = this.client ?? new LayerClient();
      this.#provider = new ContextProvider(this, {
        context: layerClientContext,
        initialValue: c,
      });
    }
  }

  updated(changed: PropertyValues<this>): void {
    // Only react to an explicit `.client` assignment — do not replace the
    // auto-created client when `client` is still undefined.
    if (
      !changed.has("client") ||
      this.#provider === null ||
      this.client === undefined
    ) {
      return;
    }
    this.#provider.setValue(this.client);
  }

  render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

/**
 * `<stack-outlet>` — renders every active layer in a stack with its registered
 * component. Light DOM (`createRenderRoot()` returns `this`) so overlays stack
 * inline where mounted. Id-keyed `repeat` keeps instances stable across updates.
 */
export class StackOutlet extends LitElement {
  static properties = {
    stack: { type: String },
    rootProps: { attribute: false },
    client: { attribute: false },
  };
  declare stack: string;
  declare rootProps: unknown;
  declare client: LayerClient | undefined;
  #states: StackController<LayerState[]> | null = null;
  #stack: LayerStack | null = null;
  #clientRef: LayerClient | undefined;

  constructor() {
    super();
    this.stack = "default";
    this.rootProps = undefined;
    this.client = undefined;
  }

  createRenderRoot(): this {
    return this;
  }

  #init(client: LayerClient): void {
    if (this.#states === null) {
      this.#clientRef = client;
      this.#stack = client.getStack(this.stack);
      this.#states = new StackController(
        this,
        { stack: this.stack, client },
        undefined,
        false,
      );
      this.requestUpdate();
      return;
    }
    // Context provider may push a new client via setValue — rebind.
    if (client === this.#clientRef) return;
    this.#clientRef = client;
    this.#states.reconfigure({ stack: this.stack }, client);
    this.#stack = client.getStack(this.stack);
    this.requestUpdate();
  }

  updated(changed: PropertyValues<this>): void {
    if (this.#stack === null || this.#states === null) return;

    if (
      changed.has("client") &&
      this.client &&
      this.client !== this.#clientRef
    ) {
      this.#clientRef = this.client;
      this.#states.reconfigure({ stack: this.stack }, this.client);
      this.#stack = this.client.getStack(this.stack);
      this.requestUpdate();
      return;
    }

    if (changed.has("stack") && this.#clientRef) {
      this.#states.reconfigure({ stack: this.stack }, this.#clientRef);
      this.#stack = this.#clientRef.getStack(this.stack);
      this.requestUpdate();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.client) {
      this.#init(this.client);
    } else if (this.#stack === null) {
      new ContextConsumer(this, {
        context: layerClientContext,
        subscribe: true,
        callback: (c: LayerClient) => this.#init(c),
      });
    }
  }

  render(): TemplateResult | typeof nothing {
    const stack = this.#stack;
    const states = this.#states;
    if (!stack || !states) return nothing;
    return html`${repeat(
      states.current,
      (s) => s.id,
      (s) => {
        const layer = stack.getLayer(s.id);
        const component = layer?.component as LitLayerComponent | undefined;
        if (!layer || !component) {
          warnMissingLayerComponent(s.id, s.key);
          return nothing;
        }
        const call = createCallContext(
          stack,
          layer,
          s,
          this.rootProps,
        ) as LayerCallContext<unknown, unknown>;
        return renderLayer(component, call, s);
      },
    )}`;
  }
}

/**
 * `<stack-subscribe>` — renders a selected stack value through a `.renderer`
 * callback (virtualizer `.renderItem`-shaped). Set `.stack`, `.selector`, and
 * `.renderer` (a `(value) => TemplateResult`).
 */
export class StackSubscribe extends LitElement {
  static properties = {
    stack: { type: String },
    selector: { attribute: false },
    renderer: { attribute: false },
  };
  declare stack: string;
  declare selector: (states: LayerState[]) => unknown;
  declare renderer: (value: unknown) => TemplateResult;
  #controller: StackController<unknown> | null = null;

  constructor() {
    super();
    this.stack = "default";
    this.selector = (s: LayerState[]) => s;
    this.renderer = () => html``;
  }

  createRenderRoot(): this {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.#controller === null) {
      this.#controller = useStack<unknown>(this, {
        stack: this.stack,
        select: this.selector,
      });
    }
  }

  updated(changed: PropertyValues<this>): void {
    if (this.#controller === null) return;
    if (changed.has("stack") || changed.has("selector")) {
      this.#controller.reconfigure({
        stack: this.stack,
        select: this.selector,
      });
    }
  }

  render(): TemplateResult {
    const value = this.#controller?.current;
    return this.renderer(value);
  }
}

export interface AppStack {
  open: ScopedOpen;
  dismissAll: (response?: unknown) => void;
  states: StackController<LayerState[]>;
}

/**
 * Reactive controller exposing `open` / `dismissAll` / `states` bound to one
 * stack. Returned by {@link createStackHook} as `useAppStack`.
 */
export class AppStackController implements ReactiveController {
  #client: LayerClient | undefined;
  #stackId: string;
  #states: StackController<LayerState[]>;

  constructor(
    host: ReactiveControllerHost,
    client: LayerClient | undefined,
    stackId: string,
  ) {
    this.#stackId = stackId;
    if (client) {
      this.#client = client;
    } else if (isElementHost(host)) {
      new ContextConsumer(host, {
        context: layerClientContext,
        subscribe: true,
        callback: (c: LayerClient) => {
          this.#client = c;
        },
      });
    } else {
      throw new Error(
        "[layers/lit] useAppStack needs an explicit `client` or a LitElement host so context can resolve.",
      );
    }
    this.#states = new StackController(
      host,
      { stack: stackId, client: this.#client },
      undefined,
      false,
    );
    host.addController(this);
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  get states(): StackController<LayerState[]> {
    return this.#states;
  }

  open = (<P, R = void, E = DefaultLayerError, D = unknown, RP = unknown>(
    options: OmitKeyof<OpenLayerOptions<P, R, E, D, RP>, "stack">,
  ) => {
    if (!this.#client) {
      throw new Error(
        "[layers/lit] useAppStack: LayerClient not resolved yet — call open() after the host connects.",
      );
    }
    return this.#client.open({
      ...options,
      stack: this.#stackId,
    } as OpenLayerOptions<P, R, E, D, RP>);
  }) as unknown as ScopedOpen;

  dismissAll = (response?: unknown): void => {
    this.#client?.dismissAll(this.#stackId, response);
  };
}

/**
 * `<app-host>` — light-DOM host that renders a `stack-outlet` for its `.stack`.
 * Forward host props to layers via `.rootProps` (defaults to the host element).
 * Register with {@link defineStackElements}; {@link createStackHook} returns a
 * subclass bound to its stack id.
 */
export class AppHostElement extends LitElement {
  static properties = {
    stack: { type: String },
    rootProps: { attribute: false },
  };
  declare stack: string;
  declare rootProps: unknown;

  constructor() {
    super();
    this.stack = "default";
    this.rootProps = undefined;
  }

  createRenderRoot(): this {
    return this;
  }

  render(): TemplateResult {
    return html`<stack-outlet
      .stack=${this.stack}
      .rootProps=${this.rootProps ?? this}
    ></stack-outlet>`;
  }
}

export interface AppLayerProps<P, R = unknown> {
  /** Layer definition with the stack supplied by the factory. */
  options: OmitKeyof<LayerOptions<P, R>, "stack">;
  /** Controlled visibility. `true` opens the layer; `false` dismisses it. */
  open: boolean;
  payload: P;
  /** Called when the layer resolves. */
  onResolved?: (response: R) => void;
}

/**
 * Reactive controller for a controlled layer bound to one stack. Set `.open` to
 * `true` to open and `false` to dismiss; `.payload` / `.options` / `.onResolved`
 * update the live layer. Dismisses automatically when the host disconnects.
 */
export class AppLayerController<
  P = unknown,
  R = unknown,
> implements ReactiveController {
  #client: LayerClient | undefined;
  #stackId: string;
  #opened = false;
  #connected = false;

  options: OmitKeyof<LayerOptions<P, R>, "stack">;
  #open: boolean;
  payload: P;
  onResolved?: (response: R) => void;

  constructor(
    host: ReactiveControllerHost,
    client: LayerClient | undefined,
    stackId: string,
    props: AppLayerProps<P, R>,
  ) {
    this.#stackId = stackId;
    this.options = props.options;
    this.#open = props.open;
    this.payload = props.payload;
    this.onResolved = props.onResolved;
    if (client) {
      this.#client = client;
    } else if (isElementHost(host)) {
      new ContextConsumer(host, {
        context: layerClientContext,
        subscribe: true,
        callback: (c: LayerClient) => {
          this.#client = c;
          if (this.#connected) this.#sync();
        },
      });
    }
    host.addController(this);
  }

  get open(): boolean {
    return this.#open;
  }
  set open(v: boolean) {
    this.#open = v;
    this.#sync();
  }

  hostConnected(): void {
    this.#connected = true;
    this.#sync();
  }

  hostDisconnected(): void {
    this.#connected = false;
    if (this.#opened && this.#client) {
      const stack = this.#client.getStack(this.#stackId);
      const layer = stack.find(this.options.key);
      if (layer) stack.dismiss(layer, undefined as never);
      this.#opened = false;
    }
  }

  #sync(): void {
    if (!this.#client) return;
    if (this.#open && !this.#opened) {
      this.#opened = true;
      void this.#client
        .open({
          ...this.options,
          stack: this.#stackId,
          payload: this.payload,
        } as OpenLayerOptions<P, R>)
        .then((response) => {
          this.#opened = false;
          this.onResolved?.(response as R);
        });
    } else if (!this.#open && this.#opened) {
      const stack = this.#client.getStack(this.#stackId);
      const layer = stack.find(this.options.key);
      if (layer) stack.dismiss(layer, undefined as never);
      this.#opened = false;
    }
  }
}

export interface StackHook {
  /** Provider CE subclass bound to the hook's default client. */
  StackProvider: typeof StackProvider;
  /** Reactive controller for the bound stack's `open` / `dismissAll` / `states`. */
  useAppStack: (host: ReactiveControllerHost) => AppStackController;
  /** `<app-host>` subclass bound to the hook's stack id. */
  AppHost: typeof AppHostElement;
  /** Controlled-layer controller constructor bound to the hook's stack. */
  AppLayer: new (
    host: ReactiveControllerHost,
    props: AppLayerProps<unknown, unknown>,
  ) => AppLayerController;
}

/**
 * Create a provider, app-stack controller, app-host, and controlled-layer
 * controller bound to one stack. Mirrors the React/Vue/Solid `createStackHook`.
 */
export function createStackHook(
  config: {
    client?: LayerClient;
    stack?: string;
  } = {},
): StackHook {
  const stackId = config.stack ?? "default";
  const defaultClient = config.client;

  class BoundStackProvider extends StackProvider {
    connectedCallback(): void {
      if (this.client === undefined && defaultClient !== undefined) {
        this.client = defaultClient;
      }
      super.connectedCallback();
    }
  }

  function useAppStack(host: ReactiveControllerHost): AppStackController {
    return new AppStackController(host, defaultClient, stackId);
  }

  class BoundAppHost extends AppHostElement {
    constructor() {
      super();
      this.stack = stackId;
    }
  }

  class BoundAppLayer extends AppLayerController {
    constructor(
      host: ReactiveControllerHost,
      props: AppLayerProps<unknown, unknown>,
    ) {
      super(host, defaultClient, stackId, props);
    }
  }

  return {
    StackProvider: BoundStackProvider,
    useAppStack,
    AppHost: BoundAppHost,
    AppLayer: BoundAppLayer,
  };
}

const STACK_ELEMENTS = [
  ["stack-provider", StackProvider],
  ["stack-outlet", StackOutlet],
  ["stack-subscribe", StackSubscribe],
  ["app-host", AppHostElement],
] as const;

/**
 * Idempotently register the stack custom elements: `stack-provider`,
 * `stack-outlet`, `stack-subscribe`, and `app-host`. Safe to call multiple
 * times; not auto-invoked on import (tenets 2 + 4).
 */
export function defineStackElements(): void {
  if (typeof customElements === "undefined") return;
  for (const [tag, ctor] of STACK_ELEMENTS) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
}
