import { Layer } from "./layer";
import { createLayerGcCache } from "./layerGcCache";
import { notifyManager } from "./notifyManager";
import { Subscribable } from "./subscribable";
import type {
  DefaultLayerError,
  DismissAllOptions,
  DismissOptions,
  LayerKey,
  LayerState,
  StackBlockerFn,
  StackOptions,
} from "./types";
import { keySignature } from "./utils";
import { validatePayload } from "./validators";
import type { Validator } from "./validators";

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

interface QueuedEntry<P, R, E, D> {
  layer: Layer<P, R, E, D>;
  commit: () => void;
}

/**
 * Manages the ordered layers for one surface.
 * Snapshots retain their references across batched notifications until their contents change.
 */
export class LayerStack<
  P = unknown,
  R = void,
  E = DefaultLayerError,
  D = unknown,
> extends Subscribable {
  readonly id: string;
  readonly options: StackOptions;

  /** @internal Allows LayerClient to drain child stacks on dismissal. */
  onLayerDismiss?: (layer: Layer<P, R, E, D>) => void;

  #layers: Layer<P, R, E, D>[] = [];
  #snapshot: LayerState<P, R, E, D>[] = [];
  #queuedSnapshot: LayerState<P, R, E, D>[] = [];
  #scopeQueue: QueuedEntry<P, R, E, D>[] = [];
  #gcCache = createLayerGcCache<P, R, E, D>({
    gcTime: () => this.options.gcTime ?? 0,
    onBeforeStore: (layer) =>
      layer.setPartial({ phase: "dismissed", transition: "settled" }),
  });
  #blockers = new Set<StackBlockerFn>();

  constructor(id: string, options: StackOptions = {}) {
    super();
    this.id = id;
    this.options = options;
  }

  /** Returns a referentially stable snapshot between mutations. */
  getSnapshot = (): LayerState<P, R, E, D>[] => this.#snapshot;

  /** Returns serially queued layers, which are excluded from `getSnapshot`. */
  getQueuedSnapshot = (): LayerState<P, R, E, D>[] => this.#queuedSnapshot;

  getLayer(id: string): Layer<P, R, E, D> | undefined {
    return this.#layers.find((l) => l.id === id);
  }

  find(key: LayerKey): Layer<P, R, E, D> | undefined {
    const sig = keySignature(key);
    return this.#layers.find((l) => keySignature(l.key) === sig);
  }

  addBlocker(fn: StackBlockerFn): () => void {
    this.#blockers.add(fn);
    return () => this.#blockers.delete(fn);
  }

  get #serial(): boolean {
    return this.options.scope?.strategy === "serial";
  }

  #hasActive(): boolean {
    return this.#layers.some(
      (l) => l.state.phase === "pending" || l.state.phase === "active",
    );
  }

  open(opts: OpenOpts<P, D>): Layer<P, R, E, D> {
    return notifyManager.batch(() => {
      let payload = opts.payload;
      if (opts.validate) {
        try {
          payload = validatePayload(opts.validate, opts.payload);
        } catch (error) {
          const layer = new Layer<P, R, E, D>({
            key: opts.key,
            payload: opts.payload,
            index: this.#layers.length,
            stackSize: this.#layers.length,
            component: opts.component,
            enteringDelay: opts.enteringDelay,
            exitingDelay: opts.exitingDelay,
          });
          layer.reject(error as E);
          return layer;
        }
      }

      if (opts.upsert) {
        const existing = this.find(opts.key);
        if (existing) {
          existing.setPartial({ payload });
          this.#flush();
          return existing;
        }
      }

      // Cached data suppresses a second load when the same key reopens.
      const cached = this.#gcCache.take(opts.key);
      const loadFn = cached ? undefined : opts.loadFn;
      const data = cached?.state.data;

      const layer = new Layer<P, R, E, D>({
        key: opts.key,
        payload,
        index: this.#layers.length,
        stackSize: this.#layers.length + 1,
        component: opts.component,
        enteringDelay: opts.enteringDelay,
        exitingDelay: opts.exitingDelay,
        data,
      });

      const commit = () => this.#commit(layer, loadFn);

      if (this.#serial && this.#hasActive()) {
        this.#scopeQueue.push({ layer, commit });
        layer.setPartial({ phase: "queued" });
        this.#flush();
        return layer;
      }

      commit();
      return layer;
    });
  }

  #commit(layer: Layer<P, R, E, D>, loadFn: OpenOpts<P, D>["loadFn"]): void {
    this.#layers = [...this.#layers, layer];
    this.#reindex();
    const entering = layer.enteringDelay > 0;
    layer.setPartial({
      phase: loadFn ? "pending" : "active",
      transition: entering ? "entering" : "settled",
    });
    this.#flush();
    if (entering) {
      layer.enterTimer = setTimeout(
        () => this.#settleEnter(layer),
        layer.enteringDelay,
      );
    }
    if (loadFn) {
      void this.#runLoad(layer, loadFn);
    }
  }

  #settleEnter(layer: Layer<P, R, E, D>): void {
    layer.enterTimer = undefined;
    notifyManager.batch(() => {
      layer.setPartial({ transition: "settled" });
      this.#flush();
    });
  }

  async #runLoad(
    layer: Layer<P, R, E, D>,
    loadFn: NonNullable<OpenOpts<P, D>["loadFn"]>,
  ): Promise<void> {
    try {
      const data = await loadFn({
        payload: layer.state.payload,
        signal: layer.abortController.signal,
      });
      if (layer.aborted) {
        return;
      }
      layer.setPartial({ data, phase: "active" });
      this.#flush();
    } catch (error) {
      if (layer.aborted) {
        return;
      }
      layer.setPartial({ error: error as E, phase: "error" });
      layer.reject(error as E);
      this.#flush();
    }
  }

  /**
   * Resolves the caller and aborts in-flight loading.
   * Exiting layers remain mounted until their transition settles.
   */
  dismiss(
    layer: Layer<P, R, E, D>,
    response: R,
    opts?: DismissOptions,
  ): Promise<boolean> {
    if (opts?.force) {
      this.#commitDismiss(layer, response);
      return Promise.resolve(true);
    }
    if (layer.dismissPending) {
      return layer.dismissPending;
    }
    layer.dismissPending = this.#guardedDismiss(layer, response).finally(() => {
      layer.dismissPending = undefined;
    });
    return layer.dismissPending;
  }

  async #guardedDismiss(
    layer: Layer<P, R, E, D>,
    response: R,
  ): Promise<boolean> {
    notifyManager.batch(() => {
      layer.setPartial({ dismissing: true });
      this.#flush();
    });
    const vetoed = await this.#vetoed(layer);
    // A concurrent force may have already dismissed while we awaited.
    if (layer.state.phase === "dismissed") {
      return true;
    }
    if (vetoed) {
      notifyManager.batch(() => {
        layer.setPartial({ dismissing: false });
        this.#flush();
      });
      return false;
    }
    this.#commitDismiss(layer, response);
    return true;
  }

  async #vetoed(layer: Layer<P, R, E, D>): Promise<boolean> {
    const checks: Array<() => boolean | Promise<boolean>> = [
      ...[...layer.blockers].map((fn) => () => fn()),
      ...[...this.#blockers].map((fn) => () => fn(layer.state as LayerState)),
    ];
    for (const check of checks) {
      let allowed: boolean;
      try {
        allowed = await check();
      } catch (error) {
        // Fail-closed: an errored predicate vetoes (protect user data).
        console.warn("[layers] blocker threw; treating as veto", error);
        allowed = false;
      }
      if (!allowed) {
        return true;
      }
    }
    return false;
  }

  #commitDismiss(layer: Layer<P, R, E, D>, response: R): void {
    notifyManager.batch(() => {
      layer.abort();
      layer.resolve(response);
      layer.setPartial({
        phase: "dismissed",
        transition: "exiting",
        ended: true,
        response,
        dismissing: false,
      });
      this.#flush();
      this.onLayerDismiss?.(layer);
    });
    if (layer.exitingDelay > 0) {
      layer.exitTimer = setTimeout(
        () => this.#remove(layer),
        layer.exitingDelay,
      );
    } else {
      this.#remove(layer);
    }
  }

  settle(layer: Layer<P, R, E, D>): void {
    const t = layer.state.transition;
    if (t === "entering") {
      if (layer.enterTimer) {
        clearTimeout(layer.enterTimer);
        layer.enterTimer = undefined;
      }
      notifyManager.batch(() => {
        layer.setPartial({ transition: "settled" });
        this.#flush();
      });
    } else if (t === "exiting") {
      if (layer.exitTimer) {
        clearTimeout(layer.exitTimer);
        layer.exitTimer = undefined;
      }
      this.#remove(layer);
    }
  }

  async dismissAll(response: R, opts?: DismissAllOptions): Promise<void> {
    const mode = opts?.mode ?? this.options.dismissAllMode ?? "skipBlocked";
    notifyManager.batch(() => {
      // Drain the queue FIRST so a dismissed active layer's #remove does
      // not activate a queued one. Queued callers get their response
      // without ever mounting.
      for (const entry of [...this.#scopeQueue]) {
        entry.layer.abort();
        entry.layer.resolve(response);
        entry.layer.setPartial({
          phase: "dismissed",
          transition: "settled",
          ended: true,
          response,
        });
      }
      this.#scopeQueue = [];
      this.#flush();
    });
    for (const l of this.#layers) {
      if (mode === "force") {
        await this.dismiss(l, response, { force: true });
        continue;
      }
      const ok = await this.dismiss(l, response);
      if (!ok && mode === "stopAtBlocked") {
        return;
      }
    }
  }

  /** Resolves and removes a serially queued layer without mounting it. */
  cancelQueued(key: LayerKey, response: R): boolean {
    return notifyManager.batch(() => {
      const sig = keySignature(key);
      const idx = this.#scopeQueue.findIndex(
        (entry) => keySignature(entry.layer.key) === sig,
      );
      if (idx === -1) {
        return false;
      }
      const entry = this.#scopeQueue[idx]!;
      entry.layer.abort();
      entry.layer.resolve(response);
      entry.layer.setPartial({
        phase: "dismissed",
        transition: "settled",
        ended: true,
        response,
      });
      this.#scopeQueue.splice(idx, 1);
      this.#flush();
      return true;
    });
  }

  update(layer: Layer<P, R, E, D>, patch: Partial<P>): void {
    notifyManager.batch(() => {
      layer.setPartial({ payload: { ...layer.state.payload, ...patch } });
      this.#flush();
    });
  }

  setRunning(layer: Layer<P, R, E, D>, running: boolean): void {
    notifyManager.batch(() => {
      layer.setRunning(running);
      this.#flush();
    });
  }

  #remove(layer: Layer<P, R, E, D>): void {
    notifyManager.batch(() => {
      this.#layers = this.#layers.filter((l) => l.id !== layer.id);
      this.#reindex();
      this.#flush();
      this.#gcCache.maybeStore(layer);
      if (this.#serial && !this.#hasActive()) {
        const next = this.#scopeQueue.shift();
        if (next) {
          next.commit();
        }
      }
    });
  }

  #reindex(): void {
    this.#layers.forEach((l, i) =>
      l.setPartial({ index: i, stackSize: this.#layers.length }),
    );
  }

  /** Preserves snapshot identity when batching produces no observable change. */
  #flush(): void {
    const next = this.#layers.map((l) => l.state);
    const nextQueued = this.#scopeQueue.map((entry) => entry.layer.state);
    const snapshotUnchanged =
      next.length === this.#snapshot.length &&
      next.every((s, i) => s === this.#snapshot[i]);
    const queuedUnchanged =
      nextQueued.length === this.#queuedSnapshot.length &&
      nextQueued.every((s, i) => s === this.#queuedSnapshot[i]);
    if (snapshotUnchanged && queuedUnchanged) {
      return;
    }
    if (!snapshotUnchanged) {
      this.#snapshot = next;
    }
    if (!queuedUnchanged) {
      this.#queuedSnapshot = nextQueued;
    }
    this.notify();
  }
}
