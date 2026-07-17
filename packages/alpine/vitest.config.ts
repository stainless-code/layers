import { defineConfig } from "vitest/config";

// Real alpinejs + jsdom — bun:test cannot run Alpine's mutation lifecycle.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.ts"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
