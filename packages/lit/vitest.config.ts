import { defineConfig } from "vitest/config";

// Lit custom elements + @lit/context need a DOM and the customElements
// registry that bun:test can't provide. Scoped to `tests-dom/**`.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.ts"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
