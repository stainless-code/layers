import { notifyManager } from "./notifyManager";

type Listener = () => void;

/**
 * Base for stores whose listeners participate in {@link notifyManager} batching.
 * Wrapping occurs once at subscription, so repeated notifications in one batch
 * coalesce for framework and bare subscribers alike.
 */
export class Subscribable {
  protected listeners = new Map<Listener, Listener>();

  subscribe(listener: Listener): () => void {
    const wrapped = notifyManager.batchCalls(listener);
    this.listeners.set(listener, wrapped);
    this.onSubscribe?.();
    return () => {
      this.listeners.delete(listener);
      this.onUnsubscribe?.();
    };
  }

  protected notify(): void {
    for (const wrapped of this.listeners.values()) {
      wrapped();
    }
  }

  protected onSubscribe?(): void;
  protected onUnsubscribe?(): void;

  get size(): number {
    return this.listeners.size;
  }
}
