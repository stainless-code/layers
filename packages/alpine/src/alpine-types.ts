interface AlpineDirectiveUtils {
  Alpine: AlpineLike;
  effect: (fn: () => void) => void;
  cleanup: (fn: () => void) => void;
  evaluate: (expression: string) => unknown;
  evaluateLater: (
    expression: string,
  ) => (callback: (value: unknown) => void) => void;
}

type AlpineDirectiveHandler = (
  el: Element,
  directive: {
    value?: string;
    modifiers: string[];
    expression: string;
  },
  utils: AlpineDirectiveUtils,
) => void;

/** Minimal Alpine surface used by the adapter (no `@types/alpinejs` required). */
export interface AlpineLike {
  reactive<T extends object>(obj: T): T;
  magic(
    name: string,
    fn: (el: Element, utils: { Alpine: AlpineLike }) => unknown,
  ): void;
  directive(name: string, fn: AlpineDirectiveHandler): void;
  data(
    name: string,
    factory: (...args: unknown[]) => Record<string, unknown>,
  ): void;
  initTree(el: Element): void;
  destroyTree(el: Element): void;
}
