import { layerOptions } from "@stainless-code/layers";

export const toastOptions = layerOptions<{ msg: string }, void>({
  stack: "default",
  key: ["toast"],
  component: undefined,
  exitingDelay: 0,
});

export const dupOptions = layerOptions<{ n: number }, boolean>({
  stack: "default",
  key: ["dup"],
  component: undefined,
  exitingDelay: 0,
});
