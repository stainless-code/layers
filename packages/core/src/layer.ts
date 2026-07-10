import { ControlledPromise } from "./controlledPromise";
import type {
  BlockerFn,
  DefaultLayerError,
  LayerKey,
  LayerState,
} from "./types";
import { hashKey } from "./utils";

/** Distinguishes concurrent instances that share a key. */
let instanceCounter = 0;

/** Runtime state and cancellation resources for one stack entry. */
export class Layer<P = unknown, R = void, E = DefaultLayerError, D = unknown> {
  readonly id: string;
  readonly key: LayerKey;
  readonly promise: ControlledPromise<R>;
  readonly abortController: AbortController;
  readonly component?: unknown;
  readonly enteringDelay: number;
  readonly exitingDelay: number;

  enterTimer?: ReturnType<typeof setTimeout>;
  exitTimer?: ReturnType<typeof setTimeout>;

  aborted = false;
  dismissPending?: Promise<boolean>;
  #blockers = new Set<BlockerFn>();
  #state: LayerState<P, R, E, D>;

  constructor(opts: {
    key: LayerKey;
    payload: P;
    index: number;
    stackSize: number;
    component?: unknown;
    enteringDelay?: number;
    exitingDelay?: number;
    data?: D;
  }) {
    this.id = `${hashKey(opts.key)}#${++instanceCounter}`;
    this.key = opts.key;
    this.promise = new ControlledPromise<R>();
    this.abortController = new AbortController();
    this.component = opts.component;
    this.enteringDelay = opts.enteringDelay ?? 0;
    this.exitingDelay = opts.exitingDelay ?? 0;
    this.#state = {
      id: this.id,
      key: opts.key,
      payload: opts.payload,
      data: opts.data,
      phase: "pending",
      transition: "settled",
      dismissing: false,
      actionStatus: "idle",
      ended: false,
      index: opts.index,
      stackSize: opts.stackSize,
    };
  }

  get state(): LayerState<P, R, E, D> {
    return this.#state;
  }

  get blockers(): ReadonlySet<BlockerFn> {
    return this.#blockers;
  }

  addBlocker(fn: BlockerFn): () => void {
    this.#blockers.add(fn);
    return () => this.#blockers.delete(fn);
  }

  /** Returns true if the snapshot changed. */
  setPartial(patch: Partial<LayerState<P, R, E, D>>): boolean {
    for (const key of Object.keys(patch) as (keyof LayerState<P, R, E, D>)[]) {
      if (!Object.is(patch[key], this.#state[key])) {
        this.#state = { ...this.#state, ...patch };
        return true;
      }
    }
    return false;
  }

  setRunning(running: boolean): void {
    this.setPartial({ actionStatus: running ? "running" : "idle" });
  }

  /** Cancel any in-flight `loadFn`; subsequent resolutions are ignored. */
  abort(): void {
    this.aborted = true;
    this.abortController.abort();
  }

  resolve(response: R): void {
    this.promise.resolve(response);
  }

  reject(error: E): void {
    this.promise.reject(error);
  }
}
