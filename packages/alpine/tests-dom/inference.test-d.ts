import { LayerClient, layerOptions } from "@stainless-code/layers";

import { createLayer, setLayerClient } from "../src/index";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

const client = new LayerClient();
setLayerClient(client);
const opts = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["confirm"],
  exitingDelay: 0,
});
const handle = createLayer(opts, client);
const pending = handle.open({ title: "x" });
type OpenResult = Expect<Equal<typeof pending, Promise<boolean>>>;
export type _CreateLayerOpen = OpenResult;
