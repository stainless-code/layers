/**
 * CDN / `unpkg` bootstrap — register the plugin on `alpine:init`.
 * Load this module **before** Alpine's CDN script so the listener is attached
 * in time. Same runtime as `Alpine.plugin(layers)` from the package root.
 */
import layers from "./index.js";

document.addEventListener("alpine:init", () => {
  const Alpine = (
    window as Window & { Alpine?: { plugin: (fn: typeof layers) => void } }
  ).Alpine;
  if (!Alpine) {
    throw new Error(
      "[layers/alpine] CDN entry requires window.Alpine before alpine:init.",
    );
  }
  Alpine.plugin(layers);
});

export { layers };
