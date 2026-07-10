import { defineConfig } from "vitest/config";

// Vue reactivity (`shallowRef` + `onScopeDispose`) needs a DOM + mounted
// component that bun:test can't provide. Components are render-function based
// (no SFCs), so no `@vitejs/plugin-vue` is required. Scoped to `tests-dom/**`.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.{ts,tsx}"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
