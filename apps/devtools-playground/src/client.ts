import { LayerClient } from "@stainless-code/react-layers";

export const MODAL_STACK = "modal";
export const TOAST_STACK = "toast";
export const WIZARD_STACK = "wizard";

export const layerClient = new LayerClient({
  defaultStackOptions: {
    [WIZARD_STACK]: { scope: { strategy: "serial" } },
  },
});

// Seed stacks so the DevTools panel lists them before the first open.
layerClient.ensureStack(MODAL_STACK);
layerClient.ensureStack(TOAST_STACK);
layerClient.ensureStack(WIZARD_STACK);
