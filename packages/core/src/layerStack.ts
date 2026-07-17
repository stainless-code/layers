import { Layer } from "./layer";
import { createLayerGcCache } from "./layerGcCache";
import { notifyManager } from "./notifyManager";
import { Subscribable } from "./subscribable";
import type {
  DefaultLayerError,
  DismissAllOptions,
  DismissOptions,
  LayerKey,
  LayerNotifyView,
  LayerState,
  StackBlockerFn,
  StackNotifyAction,
  StackNotifyEvent,
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

  /** @internal Fan-out hook for {@link LayerClient#subscribeNotify}. */
  onNotify?: (event: StackNotifyEvent) => void;

  #layers: Layer<P, R, E, D>[] = [];
  #snapshot: LayerState<P, R, E, D>[] = [];
  #queuedSnapshot: LayerState<P, R, E, D>[] = [];
  #scopeQueue: QueuedEntry<P, R, E, D>[] = [];
  #notifySeq = 0;
  #pendingNotifyAction?: StackNotifyAction;
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

  /** @internal First materialization ping for devtools registry. */
  emitRegisterNotify(): void {
    this.#emitNotify("register");
  }

  getLayer(id: string): Layer<P, R, E, D> | undefined {
    return this.#layers.find((l) => l.id === id);
  }

  find(key: LayerKey): Layer<P, R, E, D> | undefined {
    const sig = keySignature(key);
    return this.#layers.findLast((l) => keySignature(l.key) === sig);
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
          this.#dispatch("update", () => {
            existing.setPartial({ payload });
            this.#flush();
          });
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
        this.#dispatch("queue", () => {
          this.#scopeQueue.push({ layer, commit });
          layer.setPartial({ phase: "queued" });
          this.#flush();
        });
        return layer;
      }

      this.#dispatch("open", () => {
        commit();
      });
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
      this.#dispatch("settle", () => {
        layer.setPartial({ transition: "settled" });
        this.#flush();
      });
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
      this.#dispatch("phase", () => {
        this.#flush();
      });
    } catch (error) {
      if (layer.aborted) {
        return;
      }
      layer.setPartial({ error: error as E, phase: "error" });
      layer.reject(error as E);
      this.#dispatch("phase", () => {
        this.#flush();
      });
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
      this.#dispatch("phase", () => {
        layer.setPartial({ dismissing: true });
        this.#flush();
      });
    });
    const vetoed = await this.#vetoed(layer);
    // A concurrent force may have already dismissed while we awaited.
    if (layer.state.phase === "dismissed") {
      return true;
    }
    if (vetoed) {
      notifyManager.batch(() => {
        this.#dispatch("phase", () => {
          layer.setPartial({ dismissing: false });
          this.#flush();
        });
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
      this.#dispatch("dismiss", () => {
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
        this.#dispatch("settle", () => {
          layer.setPartial({ transition: "settled" });
          this.#flush();
        });
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
      this.#dispatch("dismissAll", () => {
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

  /**
   * Resolves and removes a serially queued layer without mounting it (skips blockers).
   * No `id` → FIFO head for the key; `{ id }` → exact queued match.
   */
  cancelQueued(key: LayerKey, response: R, opts?: { id?: string }): boolean {
    return notifyManager.batch(() => {
      return this.#dispatch("cancelQueued", () => {
        const sig = keySignature(key);
        const idx = this.#scopeQueue.findIndex((entry) => {
          if (keySignature(entry.layer.key) !== sig) return false;
          if (opts?.id !== undefined) return entry.layer.id === opts.id;
          return true;
        });
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
    });
  }

  update(layer: Layer<P, R, E, D>, patch: Partial<P>): void {
    notifyManager.batch(() => {
      this.#dispatch("update", () => {
        layer.setPartial({ payload: { ...layer.state.payload, ...patch } });
        this.#flush();
      });
    });
  }

  setRunning(layer: Layer<P, R, E, D>, running: boolean): void {
    notifyManager.batch(() => {
      this.#dispatch("setRunning", () => {
        layer.setRunning(running);
        this.#flush();
      });
    });
  }

  #remove(layer: Layer<P, R, E, D>): void {
    notifyManager.batch(() => {
      this.#dispatch("remove", () => {
        this.#layers = this.#layers.filter((l) => l.id !== layer.id);
        this.#reindex();
        this.#flush();
        this.#gcCache.maybeStore(layer);
        if (this.#serial && !this.#hasActive()) {
          const next = this.#scopeQueue.shift();
          if (next) {
            this.#dispatch("open", () => {
              next.commit();
            });
          }
        }
      });
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
    const action = this.#pendingNotifyAction;
    if (action !== undefined) {
      this.#pendingNotifyAction = undefined;
      this.#emitNotify(action);
    }
  }

  #dispatch<T>(action: StackNotifyAction, run: () => T): T {
    this.#pendingNotifyAction = action;
    try {
      return run();
    } finally {
      this.#pendingNotifyAction = undefined;
    }
  }

  #emitNotify(action: StackNotifyAction): void {
    if (!this.onNotify) {
      return;
    }
    this.#notifySeq += 1;
    this.onNotify({
      stackId: this.id,
      seq: this.#notifySeq,
      ts: Date.now(),
      action,
      active: this.#snapshot.map((state) => projectLayerNotifyView(state)),
      queued: this.#queuedSnapshot.map((state) =>
        projectLayerNotifyView(state),
      ),
    });
  }
}

function projectLayerNotifyView(
  state: LayerState<unknown, unknown, unknown, unknown>,
): LayerNotifyView {
  const { payload, payloadTruncated } = projectJsonSafePayload(state.payload);
  const view: LayerNotifyView = {
    id: state.id,
    key: keySignature(state.key),
    phase: state.phase,
    transition: state.transition,
    actionStatus: state.actionStatus,
    dismissing: state.dismissing,
    ended: state.ended,
    index: state.index,
    stackSize: state.stackSize,
  };
  if (payload !== undefined) {
    view.payload = payload;
  }
  if (payloadTruncated) {
    view.payloadTruncated = true;
  }
  return view;
}

function projectJsonSafePayload(raw: unknown): {
  payload?: unknown;
  payloadTruncated?: boolean;
} {
  try {
    return { payload: JSON.parse(JSON.stringify(raw)) as unknown };
  } catch {
    return { payloadTruncated: true };
  }
}
