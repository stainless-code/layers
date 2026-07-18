import { afterEach, describe, expect, it } from "bun:test";

import { resolveDefaultTheme } from "./resolveDefaultTheme";

function stubWindowMatchMedia(matches: boolean) {
  const previous = (globalThis as { window?: Window }).window;
  const matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }) as MediaQueryList;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { matchMedia },
  });

  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: previous,
      });
    }
  };
}

describe("resolveDefaultTheme", () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("returns dark when window is unavailable", () => {
    expect(resolveDefaultTheme()).toBe("dark");
  });

  it("returns dark when prefers-color-scheme: dark matches", () => {
    restore = stubWindowMatchMedia(true);
    expect(resolveDefaultTheme()).toBe("dark");
  });

  it("returns light when prefers-color-scheme: dark does not match", () => {
    restore = stubWindowMatchMedia(false);
    expect(resolveDefaultTheme()).toBe("light");
  });
});
