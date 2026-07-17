import { ThemeContextProvider } from "@tanstack/devtools-ui";
import type { TanStackDevtoolsTheme } from "@tanstack/devtools-ui";

import { LayersContextProvider } from "../LayersContextProvider";
import { Shell } from "./Shell";

interface DevtoolsProps {
  theme: TanStackDevtoolsTheme;
}

export default function LayersDevtools(props: DevtoolsProps) {
  return (
    <ThemeContextProvider theme={props.theme}>
      <LayersContextProvider>
        <Shell />
      </LayersContextProvider>
    </ThemeContextProvider>
  );
}
