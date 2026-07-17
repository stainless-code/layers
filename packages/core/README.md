# @stainless-code/layers

<!-- TODO: once the docs site (https://stainless-code.com/layers) is deployed, swap this src to https://stainless-code.com/layers/logo.svg for a stable, self-owned URL. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The zero-dependency, framework-agnostic core of Layers — the layer/stack engine every adapter wraps. State coordination, not UI ownership: it owns ordering, keys, transitions, blockers, and the `await client.open(...)` contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/layers`

**Peer:** none. App developers install a [framework adapter](https://stainless-code.com/layers/adapters) instead.

## Taste

```ts
import {
  LayerClient,
  layerOptions,
  createLayer,
  createCallContext,
} from "@stainless-code/layers";

const client = new LayerClient();
const confirm = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "remove"],
});

const c = createLayer(confirm, client);

const stack = client.getStack("confirm");
stack.subscribe(() => {
  for (const state of stack.getSnapshot()) {
    const call = createCallContext(stack, stack.getLayer(state.id)!, state);
    // render the layer; call.end(response) resolves `await c.open(...)`.
  }
});

const ok = await c.open({ title: "Remove?" });
```

## Docs

- [Core adapter](https://stainless-code.com/layers/adapters/core)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/core)
