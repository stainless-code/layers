import react from "@vitejs/plugin-react";
import { defineConfig } from "tsdown";

export default defineConfig({
  plugins: [react()],
  entry: ["./src/index.ts", "./src/production.ts"],
  format: ["esm"],
  unbundle: true,
  dts: true,
  clean: true,
  minify: false,
});
