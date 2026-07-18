import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function overlayPortal(node: ReactNode): ReactNode {
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
