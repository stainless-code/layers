import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", cdn: "src/cdn.ts" },
  outDir: "dist",
  format: "esm",
  dts: true,
  clean: true,
});
