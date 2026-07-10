import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

// Svelte runes reactivity (`createSubscriber`) + component lifecycle
// (`onDestroy`) need a DOM + Svelte's compiler that bun:test can't provide.
// `.svelte` test components are compiled by the plugin; `svelteTesting` wires
// the browser conditions + auto-cleanup. Scoped to `tests-dom/**`.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.ts"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
