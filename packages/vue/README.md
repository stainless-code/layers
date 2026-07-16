# @stainless-code/vue-layers

<!-- TODO: once the docs site (https://stainless-code.com/layers) is deployed, swap this src to https://stainless-code.com/layers/logo.svg for a stable, self-owned URL. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Vue adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/vue-layers`

**Peer:** `vue` (`>=3.3.0`)

## Taste

```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";
const { call, payload } =
  defineProps<LayerComponentProps<{ title: string }, boolean>>();
</script>
<template>
  <div role="dialog">
    <h2>{{ payload.title }}</h2>
    <button @click="() => void call.end(true)">Yes</button>
    <button @click="() => void call.end(false)">No</button>
  </div>
</template>
```

```ts
// confirm.ts
import { layerOptions } from "@stainless-code/vue-layers";
import ConfirmDialog from "./ConfirmDialog.vue";

export const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import {
  provideLayerClient,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/vue-layers";
import { confirm } from "./confirm";

provideLayerClient();
const client = useLayerClient();

async function remove() {
  const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
  if (ok) deleteItem();
}
</script>
<template>
  <StackOutlet stack="confirm" />
  <button @click="remove">Remove</button>
</template>
```

## Docs

- [Vue adapter](https://stainless-code.com/layers/adapters/vue)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/vue)
