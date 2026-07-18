import type { TanStackDevtoolsTheme } from "@tanstack/devtools-ui";
import { createMemo } from "solid-js";

import { brandTokens } from "../brand";

/** Docs mark (`apps/docs/public/logo.svg`) — solid bar fills for light/dark contrast. */
export function LayersLogo(props: {
  theme: TanStackDevtoolsTheme;
  size?: number;
}) {
  const t = createMemo(() => brandTokens(props.theme));
  const size = createMemo(() => props.size ?? 22);
  const bar = createMemo(() =>
    props.theme === "light"
      ? { soft: "#c4beb4", mid: "#9c958a", strong: "#6b6560" }
      : { soft: "#52525b", mid: "#71717a", strong: "#a1a1aa" },
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size()}
      height={size()}
      aria-hidden="true"
    >
      <rect x="2" y="17" width="20" height="3.5" rx="1" fill={bar().soft} />
      <rect x="3" y="12" width="18" height="3.5" rx="1" fill={bar().mid} />
      <rect x="5" y="7" width="16" height="3.5" rx="1" fill={t().accent} />
      <rect x="4" y="2" width="14" height="3.5" rx="1" fill={bar().strong} />
    </svg>
  );
}
