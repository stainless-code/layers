import { layerOptions } from "@stainless-code/layers";

import ChildDialog from "./ChildDialog.svelte";
import ParentDrawer from "./ParentDrawer.svelte";
import SaveDialog from "./SaveDialog.svelte";
import StoreSaveDialog from "./StoreSaveDialog.svelte";

export const childPending = { current: null as Promise<string> | null };

export const saveOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["save", "export"],
  component: SaveDialog,
  exitingDelay: 0,
});

export const storeSaveOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["save", "export"],
  component: StoreSaveDialog,
  exitingDelay: 0,
});

export const childOptions = layerOptions<{ label: string }, string>({
  key: ["drawer", "child"],
  component: ChildDialog,
  exitingDelay: 0,
});

export const parentOptions = layerOptions<{ title: string }, boolean>({
  stack: "drawer",
  key: ["drawer", "parent"],
  component: ParentDrawer,
  exitingDelay: 0,
});
