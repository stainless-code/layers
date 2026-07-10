/// <reference types="vitest" />
import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vitest/config";

// Angular components/`ViewContainerRef` rendering needs a DOM + Angular's own
// compiler (`@analogjs/vite-plugin-angular`) that bun:test can't provide. In
// test mode the plugin auto-loads `tsconfig.spec.json` (decorators + tests-dom),
// keeping `tsc --noEmit` (src only, `tsconfig.json`) separate. Scoped to
// `tests-dom/**`.
export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests-dom/test-setup.ts"],
    include: ["tests-dom/**/*.test.ts"],
  },
});
