import { StackOutlet, StackProvider } from "@stainless-code/react-layers";
import { layersDevtoolsPlugin } from "@stainless-code/react-layers-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { layerClient, MODAL_STACK, TOAST_STACK, WIZARD_STACK } from "./client";
import { DemoPage } from "./DemoPage";

export function App() {
  return (
    <StackProvider client={layerClient}>
      <DemoPage />

      <StackOutlet stack={MODAL_STACK} />
      <StackOutlet stack={WIZARD_STACK} />
      <div className="pointer-events-none fixed right-4 top-4 z-[8000] flex max-w-[360px] flex-col gap-2">
        <StackOutlet stack={TOAST_STACK} />
      </div>

      {import.meta.env.DEV ? (
        <TanStackDevtools plugins={[layersDevtoolsPlugin()]} />
      ) : null}
    </StackProvider>
  );
}
