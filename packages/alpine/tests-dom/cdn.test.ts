import { afterEach, describe, expect, it } from "vitest";

describe("Alpine adapter — CDN bootstrap", () => {
  afterEach(() => {
    delete (window as Window & { Alpine?: unknown }).Alpine;
  });

  it("registers the plugin on alpine:init when window.Alpine exists", async () => {
    const plugins: unknown[] = [];
    (window as Window & { Alpine?: { plugin: (fn: unknown) => void } }).Alpine =
      {
        plugin(fn) {
          plugins.push(fn);
        },
      };

    await import("../src/cdn");
    document.dispatchEvent(new Event("alpine:init"));
    expect(plugins.length).toBeGreaterThanOrEqual(1);
  });
});
