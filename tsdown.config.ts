import { defineConfig } from "tsdown";

const outDir = "dist";

// Subpath entries — each maps 1:1 to an `exports` entry and mirrors the
// src folder structure. The core (`core/index`) is dependency-free; the
// React adapter owns its optional `react` peer, which stays external so
// consumers tree-shake cleanly.
export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "adapters/react": "src/adapters/react.tsx",
    "adapters/svelte": "src/adapters/svelte.ts",
    "adapters/svelte-store": "src/adapters/svelte-store.ts",
    "adapters/vue": "src/adapters/vue.ts",
    "adapters/solid": "src/adapters/solid.ts",
    "adapters/preact": "src/adapters/preact.ts",
    "adapters/angular": "src/adapters/angular.ts",
  },
  outDir,
  format: "esm",
  dts: true,
  deps: {
    neverBundle: [
      "react",
      "preact",
      "svelte",
      "vue",
      "solid-js",
      "@angular/core",
    ],
  },
  clean: true,
});
