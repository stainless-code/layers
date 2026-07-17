declare module "alpinejs" {
  import type { AlpineLike } from "../src/alpine-types.js";

  interface AlpineInstance extends AlpineLike {
    plugin(callback: (Alpine: AlpineLike) => void): void;
    start(): void;
    initTree(el: Element): void;
    destroyTree(el: Element): void;
    nextTick(): Promise<void>;
    $data(el: Element): Record<string, unknown>;
  }

  const Alpine: AlpineInstance;
  export default Alpine;
}
