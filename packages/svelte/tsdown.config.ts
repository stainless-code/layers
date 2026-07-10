import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", store: "src/store.ts" },
  outDir: "dist",
  format: "esm",
  dts: true,
  clean: true,
});
