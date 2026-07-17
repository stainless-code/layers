import solid from "rolldown-plugin-solid";
import { defineConfig } from "tsdown";

const makeSolid = (ssr = false) =>
  solid({ solid: { generate: ssr ? "ssr" : "dom" } });

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    outDir: "dist",
    dts: true,
    plugins: [makeSolid()],
    clean: true,
  },
  {
    entry: { "production/index": "src/production.ts" },
    format: ["esm"],
    outDir: "dist",
    dts: true,
    plugins: [makeSolid()],
    clean: false,
  },
]);
