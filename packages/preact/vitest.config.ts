import { defineConfig } from "vitest/config";

// Preact reactivity (`useSyncExternalStore` via preact/compat) needs a DOM +
// renderer that bun:test can't provide. Scoped to `tests-dom/**`; JSX compiles
// through Preact's automatic runtime so tests read like real Preact code.
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.{ts,tsx}"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
