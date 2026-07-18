import type { TanStackDevtoolsTheme } from "@tanstack/devtools-ui";

/** Mirrors `apps/docs/theme.css`. */
const layersBrand = {
  light: {
    background: "#faf8f5",
    foreground: "#1c1b19",
    muted: "#f0ede8",
    mutedForeground: "#6b6863",
    border: "#e2ddd6",
    accent: "#0d9488",
    accentSoft: "#14b8a6",
    accentForeground: "#ffffff",
    success: "#059669",
    panel: "#ffffff",
    headerBg: "#f0ede8",
  },
  dark: {
    background: "#18181b",
    foreground: "#f5f0e8",
    muted: "#27272a",
    mutedForeground: "#a1a1aa",
    border: "#3f3f46",
    accent: "#2dd4bf",
    accentSoft: "#5eead4",
    accentForeground: "#18181b",
    success: "#34d399",
    panel: "#27272a",
    headerBg: "#27272a",
  },
} as const;

export type LayersBrandTokens = (typeof layersBrand)[TanStackDevtoolsTheme];

export function brandTokens(theme: TanStackDevtoolsTheme): LayersBrandTokens {
  return layersBrand[theme];
}
