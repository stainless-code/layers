import type { Validator } from "./validators";

/**
 * Logical identity for a layer (`find` / `upsert` / `gcTime`).
 *
 * Must be JSON-safe: `string` | `boolean` | `null` | finite `number`, or
 * plain objects / arrays of those. Compared via sorted `JSON.stringify` —
 * two keys with the same values in a different object-property order are equal.
 * Invalid keys throw `LayerKeyError` from any path that hashes the key
 * (`hashKey`, `open`, `find`, `cancelQueued`, `createLayer`).
 */
export type LayerKey = ReadonlyArray<unknown>;

export type LayerPhase =
  | "pending"
  | "queued"
  | "active"
  | "dismissed"
  | "error";

/** Animation state, independent of resolution phase. */
export type LayerTransition = "entering" | "settled" | "exiting";

export type LayerActionStatus = "idle" | "running";

/** Instance-scoped predicate — `true` allows dismissal. */
export type BlockerFn = () => boolean | Promise<boolean>;

/** Stack-scoped predicate — `true` allows dismissal. */
export type StackBlockerFn = (layer: LayerState) => boolean | Promise<boolean>;

export type DismissAllMode = "skipBlocked" | "stopAtBlocked" | "force";

export interface DismissOptions {
  force?: boolean;
}

export interface DismissAllOptions {
  mode?: DismissAllMode;
}

/** Immutable layer snapshot consumed by selectors. */
export interface LayerState<
  P = unknown,
  R = void,
  E = DefaultLayerError,
  D = unknown,
> {
  id: string;
  key: LayerKey;
  payload: P;
  data?: D;
  response?: R;
  error?: E;
  phase: LayerPhase;
  transition: LayerTransition;
  /** `true` while a user-intent dismiss is consulting blockers. */
  dismissing: boolean;
  actionStatus: LayerActionStatus;
  ended: boolean;
  index: number;
  stackSize: number;
}

/** Imperative controls available to a rendered layer. */
export interface LayerCallContext<P, R, RootProps = unknown> {
  end: (response: R, opts?: DismissOptions) => Promise<boolean>;
  dismiss: (response: R, opts?: DismissOptions) => Promise<boolean>;
  addBlocker: (fn: BlockerFn) => () => void;
  update: (patch: Partial<P>) => void;
  setRunning: (running: boolean) => void;
  /** Finishes the current transition immediately. */
  settle: () => void;
  ended: boolean;
  index: number;
  stackSize: number;
  root: RootProps;
  readonly stackId: string;
  readonly layerId: string;
}

export interface LayerComponentProps<
  P = unknown,
  R = void,
  E = DefaultLayerError,
  D = unknown,
  RootProps = unknown,
> {
  call: LayerCallContext<P, R, RootProps>;
  payload: P;
  data?: D;
  error?: E;
  phase: LayerPhase;
  transition: LayerTransition;
  dismissing: boolean;
  actionStatus: LayerActionStatus;
}

/** Framework adapters narrow this to their component type. */
export type LayerComponent = unknown;

export interface LayerOptions<
  P = unknown,
  R = void,
  E = DefaultLayerError,
  D = unknown,
  RootProps = unknown,
> {
  /** @default "default" */
  stack?: string;
  /** Stable identity; same key + `upsert` → update existing instance. */
  key: LayerKey;
  component?: LayerComponent;
  /** Enter duration in milliseconds; `call.settle()` finishes it early. @default 0 */
  enteringDelay?: number;
  /** Exit duration in milliseconds; `call.settle()` finishes it early. @default 0 */
  exitingDelay?: number;
  /** When true, reusing an active key updates its payload instead of stacking. */
  upsert?: boolean;
  /** Loads data before activation; dismissal aborts the signal. */
  loadFn?: (ctx: { payload: P; signal: AbortSignal }) => Promise<D> | D;
  /** Validates payload before opening; the parsed output becomes the payload. */
  validate?: Validator<P>;
  /** Props passed to every layer in the stack via `call.root`. */
  rootProps?: RootProps;
  /**
   * Phantom fields preserve payload/response/error inference without runtime values.
   * `@internal` is required for `stripInternal` to hide them from published declarations.
   */
  /** @internal */ readonly _payload?: P;
  /** @internal */ readonly _response?: R;
  /** @internal */ readonly _error?: E;
}

/**
 * Makes `payload` optional only when `P` admits `undefined`.
 * Optional object properties alone do not make the payload omittable.
 */
export type PayloadArg<P> = undefined extends P
  ? { payload?: P }
  : { payload: P };

export type OpenLayerOptions<
  P = unknown,
  R = void,
  E = DefaultLayerError,
  D = unknown,
  RootProps = unknown,
> = LayerOptions<P, R, E, D, RootProps> & PayloadArg<P>;

/** Rejects keys that do not exist on `T`. */
export type OmitKeyof<T, K extends keyof T> = Omit<T, K>;

/** Serial policy when a mounted layer's `loadFn` rejects. */
export type SerialOnLoadError = "block" | "advance";

export interface StackOptions {
  /**
   * Serial scope queues unmounted opens until the occupying layer leaves
   * (`pending` / `active` / `error` for `onLoadError: "block"`).
   * @default { strategy: "parallel" }
   */
  scope?: {
    strategy: "serial" | "parallel";
    /**
     * Serial only. `block` — keep `phase: "error"` until dismiss.
     * `advance` — remove the failed layer and drain the next queued open.
     * @default "block"
     */
    onLoadError?: SerialOnLoadError;
  };
  /** Retains loaded data for same-key restoration. @default 0 */
  gcTime?: number;
  /** @default "skipBlocked" */
  dismissAllMode?: DismissAllMode;
}

export type StackDefaults = Record<string, StackOptions>;

export interface LayerClientOptions {
  defaultStackOptions?: StackDefaults;
}

/** Coarse mutation label for devtools / {@link LayerClient#subscribeNotify}. */
export type StackNotifyAction =
  | "register"
  | "open"
  | "queue"
  | "update"
  | "setRunning"
  | "settle"
  | "dismiss"
  | "dismissVetoed"
  | "dismissAll"
  | "cancelQueued"
  | "phase"
  | "remove";

/** JSON-safe layer projection on {@link StackNotifyEvent}. */
export interface LayerNotifyView {
  id: string;
  /** Display string from {@link keySignature}. */
  key: string;
  phase: LayerPhase;
  transition: LayerTransition;
  actionStatus: LayerActionStatus;
  dismissing: boolean;
  ended: boolean;
  index: number;
  stackSize: number;
  payload?: unknown;
  /** `true` when `payload` could not be JSON-cloned and was omitted. */
  payloadTruncated?: boolean;
}

/** Emitted when a stack snapshot changes after a labeled mutation. */
export interface StackNotifyEvent {
  stackId: string;
  seq: number;
  ts: number;
  action: StackNotifyAction;
  active: LayerNotifyView[];
  queued: LayerNotifyView[];
}

/**
 * Module-augmentation point for app-wide type defaults.
 * Augment `defaultError` to set the library-wide error type once.
 *
 * @example
 * declare module "@stainless-code/layers" {
 *   interface Register { defaultError: AppError }
 * }
 */
export interface Register {}

/** App-wide error type configured through {@link Register}. */
export type DefaultLayerError = Register extends { defaultError: infer E }
  ? E
  : Error;
