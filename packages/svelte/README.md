# @stainless-code/svelte-layers

<!-- TODO: once the docs site (https://stainless-code.com/layers) is deployed, swap this src to https://stainless-code.com/layers/logo.svg for a stable, self-owned URL. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Svelte adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/svelte-layers`

**Peer:** `svelte` (`>=3.0.0`; runes need 5.7+)

Two entry points: [`@stainless-code/svelte-layers`](https://stainless-code.com/layers/adapters/svelte/runes) (runes, Svelte 5.7+) and [`@stainless-code/svelte-layers/store`](https://stainless-code.com/layers/adapters/svelte/store) (Svelte 3+). Pick one per app.

## Taste

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { setLayerClient, useStack } from "@stainless-code/svelte-layers";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { confirm } from "./confirm";

  setLayerClient();
  const stack = useStack({ stack: "confirm" });
</script>

{#each stack.current as s (s.id)}
  {@const call = stack.callFor(s)}
  {#if call}<ConfirmDialog {call} payload={s.payload} />{/if}
{/each}
```

```svelte
<!-- RemoveButton.svelte -->
<script lang="ts">
  import { createLayer } from "@stainless-code/svelte-layers";
  import { confirm } from "./confirm";

  const c = createLayer(confirm);

  async function handleRemove() {
    const ok = await c.open({ title: "Remove?" });
    if (!ok) return;
    deleteItem();
  }
</script>

<button type="button" onclick={() => void handleRemove()}>Remove</button>
```

The store entry uses the same `createLayer` / `useStack` pattern with Svelte stores — import from `@stainless-code/svelte-layers/store` instead.

## Docs

- [Svelte adapter (runes)](https://stainless-code.com/layers/adapters/svelte/runes)
- [Svelte adapter (store)](https://stainless-code.com/layers/adapters/svelte/store)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/svelte)
