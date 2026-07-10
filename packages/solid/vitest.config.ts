import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

// Solid's fine-grained reactivity + rendering needs a DOM and Solid's own JSX
// transform (`vite-plugin-solid`) that bun:test can't provide. Test files use
// Solid JSX; the adapter source stays non-JSX (`createComponent`/`For`).
// Scoped to `tests-dom/**`.
export default defineConfig({
  plugins: [solid()],
  resolve: { conditions: ["development", "browser"] },
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.{ts,tsx}"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
