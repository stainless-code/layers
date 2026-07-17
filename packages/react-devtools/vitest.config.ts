import { defineConfig } from "vitest/config";

// Soft-dismiss after attach needs a DOM + client renderer
// (`StackProvider` / outlet) that bun:test can't provide.
// Scoped to `tests-dom/**` so `bun test ./src` and vitest never overlap.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.{ts,tsx}"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
