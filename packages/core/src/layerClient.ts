import type { DataTag } from "./dataTag";
import { LayerStack } from "./layerStack";
import type {
  DefaultLayerError,
  DismissAllOptions,
  LayerClientOptions,
  LayerKey,
  OmitKeyof,
  OpenLayerOptions,
  StackDefaults,
  StackNotifyEvent,
  StackOptions,
} from "./types";
import type {
  InferValidatorOutput,
  OpenValidatePayload,
  Validator,
} from "./validators";

/** Prevents validated options from falling through to the unvalidated overload. */
type NoValidateOptions<Opts> = Opts extends { validate: Validator<unknown> }
  ? never
  : Opts;

type OpenImplOptions<P, R, E, D, RootProps, V extends Validator<unknown>> =
  | NoValidateOptions<OpenLayerOptions<P, R, E, D, RootProps>>
  | (OmitKeyof<
      OpenLayerOptions<InferValidatorOutput<V>, R, E, D, RootProps>,
      "payload" | "validate"
    > & { validate: V; payload: OpenValidatePayload<V> });

/** Coordinates named layer stacks. */
export class LayerClient {
  #stacks = new Map<string, LayerStack>();
  #childStacksByParent = new Map<string, Set<string>>();
  #stackListeners = new Set<(stackId: string) => void>();
  #notifyListeners = new Set<(event: StackNotifyEvent) => void>();
  #defaultStackOptions: StackDefaults;

  constructor(opts: LayerClientOptions = {}) {
    this.#defaultStackOptions = opts.defaultStackOptions ?? {};
  }

  /** Returns a stack, applying options only when creating it. */
  ensureStack(id: string, options?: StackOptions): LayerStack {
    let stack = this.#stacks.get(id);
    if (!stack) {
      const mergedOptions: StackOptions = {
        ...this.#defaultStackOptions[id],
        ...options,
      };
      stack = new LayerStack(id, mergedOptions);
      stack.onLayerDismiss = (layer) => this.#drainChildStacks(layer.id);
      stack.onNotify = (event) => {
        for (const listener of this.#notifyListeners) {
          listener(event);
        }
      };
      this.#stacks.set(id, stack);
      stack.emitRegisterNotify();
      this.#stackListeners.forEach((l) => l(id));
    }
    return stack;
  }

  #stack(id: string): LayerStack {
    return this.ensureStack(id);
  }

  bindChildStack(parentLayerId: string, childStackId: string): () => void {
    let set = this.#childStacksByParent.get(parentLayerId);
    if (!set) {
      set = new Set();
      this.#childStacksByParent.set(parentLayerId, set);
    }
    set.add(childStackId);
    return () => {
      const childSet = this.#childStacksByParent.get(parentLayerId);
      if (!childSet) {
        return;
      }
      childSet.delete(childStackId);
      if (childSet.size === 0) {
        this.#childStacksByParent.delete(parentLayerId);
      }
    };
  }

  #drainChildStacks(parentLayerId: string): void {
    const childIds = this.#childStacksByParent.get(parentLayerId);
    if (!childIds) {
      return;
    }
    for (const childId of childIds) {
      void this.#stacks.get(childId)?.dismissAll(undefined, { mode: "force" });
    }
    this.#childStacksByParent.delete(parentLayerId);
  }

  /** Accepts validator input while storing its parsed output as the payload. */
  open<
    V extends Validator<unknown>,
    P = InferValidatorOutput<V>,
    R = void,
    E = DefaultLayerError,
    D = unknown,
    RootProps = unknown,
  >(
    options: OmitKeyof<
      OpenLayerOptions<P, R, E, D, RootProps>,
      "payload" | "validate"
    > & {
      validate: V;
      payload: NoInfer<OpenValidatePayload<V>>;
    },
  ): Promise<R>;
  /** Infers response and error types from a {@link DataTag} key. */
  open<P, R, E = DefaultLayerError, D = unknown, RootProps = unknown>(
    options: OmitKeyof<
      OpenLayerOptions<P, R, E, D, RootProps> & {
        key: DataTag<LayerKey, R, E>;
      },
      "validate"
    >,
  ): Promise<R>;
  /** Opens a layer and resolves with its dismissal response. */
  open<P, R = void, E = DefaultLayerError, D = unknown, RootProps = unknown>(
    options: OmitKeyof<OpenLayerOptions<P, R, E, D, RootProps>, "validate">,
  ): Promise<R>;
  open<
    P,
    R = void,
    E = DefaultLayerError,
    D = unknown,
    RootProps = unknown,
    V extends Validator<unknown> = Validator<unknown>,
  >(options: OpenImplOptions<P, R, E, D, RootProps, V>): Promise<R> {
    const stackId = options.stack ?? "default";
    const stack = this.#stack(stackId) as unknown as LayerStack<P, R, E, D>;
    const openOptions = options as OpenLayerOptions<P, R, E, D, RootProps>;
    const layer = stack.open({
      key: openOptions.key,
      // Omitted payloads intentionally remain `undefined` when `P` admits it.
      payload: openOptions.payload as P,
      component: openOptions.component,
      exitingDelay: openOptions.exitingDelay,
      enteringDelay: openOptions.enteringDelay,
      upsert: openOptions.upsert,
      loadFn: openOptions.loadFn,
      validate: openOptions.validate,
    });
    return layer.promise.promise as Promise<R>;
  }

  getStack(id = "default"): LayerStack {
    return this.#stack(id);
  }

  getStackIds(): string[] {
    return [...this.#stacks.keys()];
  }

  /** Subscribes to first-time stack materialization. */
  subscribeStacks(listener: (stackId: string) => void): () => void {
    this.#stackListeners.add(listener);
    return () => this.#stackListeners.delete(listener);
  }

  /** Subscribes to labeled stack snapshot transitions (devtools). */
  subscribeNotify(listener: (event: StackNotifyEvent) => void): () => void {
    this.#notifyListeners.add(listener);
    return () => this.#notifyListeners.delete(listener);
  }

  dismissAll(
    stackId = "default",
    response?: unknown,
    opts?: DismissAllOptions,
  ): Promise<void> {
    return (
      this.#stack(stackId) as LayerStack<unknown, unknown, unknown, unknown>
    ).dismissAll(response, opts);
  }
}
