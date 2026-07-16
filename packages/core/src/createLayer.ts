import type { DataTag } from "./dataTag";
import type { Layer } from "./layer";
import type { LayerClient } from "./layerClient";
import type { LayerStack } from "./layerStack";
import type {
  DefaultLayerError,
  DismissOptions,
  LayerKey,
  LayerOptions,
  PayloadArg,
} from "./types";
import { keySignature } from "./utils";
import type {
  InferValidatorOutput,
  OpenValidatePayload,
  Validator,
} from "./validators";

interface OpenOpts<P, D> {
  key: LayerKey;
  payload: P;
  component?: unknown;
  enteringDelay?: number;
  exitingDelay?: number;
  upsert?: boolean;
  loadFn?: (ctx: { payload: P; signal: AbortSignal }) => Promise<D> | D;
  validate?: Validator<P>;
}

/** Prevents validated options from falling through to the unvalidated overload. */
type NoValidateOptions<Opts> = Opts extends { validate: Validator<unknown> }
  ? never
  : Opts;

/**
 * Identity-bound layer ops + escapes (`stack` / `client` / `options` / `current`).
 * `open`/`upsert` take payload only; stack-level ops route via `.stack`.
 */
export interface LayerHandle<P, R, E, D, RP> {
  open: (payload: PayloadArg<P>["payload"]) => Promise<R>;
  upsert: (payload: PayloadArg<P>["payload"]) => Promise<R>;
  dismiss: (
    response?: R,
    opts?: DismissOptions & { id?: string },
  ) => Promise<boolean>;
  update: (patch: Partial<P>, opts?: { id?: string }) => void;
  /**
   * Resolves and removes a serially queued layer without mounting (skips blockers).
   * No `id` → FIFO head for this key; `{ id }` → exact queued match.
   */
  cancelQueued: (response?: R, opts?: { id?: string }) => boolean;
  readonly client: LayerClient;
  readonly stack: LayerStack<P, R, E, D>;
  readonly options: LayerOptions<P, R, E, D, RP> & {
    key: DataTag<LayerKey, R, E>;
  };
  /** Live-checked bound instance (`null` when not in the stack). */
  readonly current: Layer<P, R, E, D> | null;
}

/**
 * Validated handle: `open`/`upsert` take schema **input** ({@link OpenValidatePayload});
 * `current`/`update` use parsed **output**.
 */
export interface ValidatedLayerHandle<
  V extends Validator<unknown>,
  R,
  E,
  D,
  RP,
> extends Omit<
  LayerHandle<InferValidatorOutput<V>, R, E, D, RP>,
  "open" | "upsert"
> {
  open: (payload: OpenValidatePayload<V>) => Promise<R>;
  upsert: (payload: OpenValidatePayload<V>) => Promise<R>;
}

/**
 * Wire `layerOptions` + a {@link LayerClient} into a headless {@link LayerHandle}.
 *
 * @example
 * ```ts
 * const c = createLayer(confirm, client);
 * const ok = await c.open({ title: "Remove?" });
 * ```
 */
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
  client: LayerClient,
): ValidatedLayerHandle<V, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: NoValidateOptions<LayerOptions<P, R, E, D, RP> & { key: LayerKey }>,
  client: LayerClient,
): LayerHandle<P, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client: LayerClient,
): LayerHandle<P, R, E, D, RP> {
  const stackId = options.stack ?? "default";
  const stack = client.getStack(stackId) as unknown as LayerStack<P, R, E, D>;
  const opts = options as LayerOptions<P, R, E, D, RP> & {
    key: DataTag<LayerKey, R, E>;
  };
  const sig = keySignature(opts.key);
  let mine: Layer<P, R, E, D> | undefined;

  const toOpenOpts = (payload: P): OpenOpts<P, D> => ({
    key: opts.key,
    payload,
    component: opts.component,
    enteringDelay: opts.enteringDelay,
    exitingDelay: opts.exitingDelay,
    upsert: opts.upsert,
    loadFn: opts.loadFn,
    validate: opts.validate,
  });

  const target = (id?: string): Layer<P, R, E, D> | undefined => {
    if (id) {
      const l = stack.getLayer(id);
      return l && keySignature(l.key) === sig ? l : undefined;
    }
    return stack.find(opts.key);
  };

  return {
    open: (payload) => {
      mine = stack.open(toOpenOpts(payload as P));
      return mine.promise.promise as Promise<R>;
    },
    upsert: (payload) => {
      mine = stack.open({ ...toOpenOpts(payload as P), upsert: true });
      return mine.promise.promise as Promise<R>;
    },
    dismiss: (response, o) => {
      const l = target(o?.id);
      return l
        ? stack.dismiss(l, response as R, { force: o?.force })
        : Promise.resolve(false);
    },
    update: (patch, o) => {
      const l = target(o?.id);
      if (l) stack.update(l, patch);
    },
    cancelQueued: (response, o) =>
      stack.cancelQueued(opts.key, response ?? (undefined as R), o),
    client,
    stack,
    options: opts,
    get current(): Layer<P, R, E, D> | null {
      return (mine ? (stack.getLayer(mine.id) ?? null) : null) as Layer<
        P,
        R,
        E,
        D
      > | null;
    },
  };
}
