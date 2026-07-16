import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Example islands render inside <article class="prose">, and Blume's prose
// overrides (e.g. `.prose :where(h2) { margin-top: 3rem }`) are unlayered, so
// they outrank Tailwind's layered utilities — `not-prose` can't defeat them.
// Portaling the overlay to document.body moves it out of `.prose` entirely,
// letting the island's utility classes apply. Modals only mount after
// hydration (on user click), so document.body is always available.
export function overlayPortal(node: ReactNode): ReactNode {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
