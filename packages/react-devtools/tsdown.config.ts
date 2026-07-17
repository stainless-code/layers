import react from "@vitejs/plugin-react";
import { defineConfig } from "tsdown";

export default defineConfig({
  plugins: [react()],
  entry: ["./src/index.ts", "./src/production.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  deps: {
    // Keep workspace type imports external in published .d.mts (not inlined from ../core/dist).
    neverBundle: [
      "@stainless-code/layers",
      "@stainless-code/layers-devtools",
      "@stainless-code/react-layers",
    ],
  },
});
