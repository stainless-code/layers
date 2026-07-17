# @stainless-code/alpine-layers

<p align="center">
  <img src="https://stainless-code.com/layers/icon.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

Alpine.js adapter — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: you own markup, focus (`@alpinejs/focus`), portals (`x-teleport`), and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/alpine-layers`

**Peer:** `alpinejs` (`>=3.13`). Optional: `@alpinejs/focus` for modal trap recipes.

## CDN

Load before Alpine core; the CDN entry listens for `alpine:init` and registers the plugin.

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@stainless-code/alpine-layers/cdn"
></script>
<script
  defer
  src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"
></script>
```

## Taste (Vite / bundled)

```js
import Alpine from "alpinejs";
import layers, {
  LayerClient,
  createLayer,
  layerOptions,
  setLayerClient,
} from "@stainless-code/alpine-layers";

const client = new LayerClient();
setLayerClient(client);
Alpine.plugin(layers);
Alpine.start();
```

```html
<div x-data>
  <template x-layer-outlet="'modal'">
    <div x-data role="dialog">
      <h2 x-text="$layer.payload.title"></h2>
      <button type="button" @click="$layer.call.end(true)">Yes</button>
    </div>
  </template>
</div>
```

```js
const confirm = layerOptions({
  stack: "modal",
  key: ["confirm"],
  exitingDelay: 0,
});
const c = createLayer(confirm, client);
void c.open({ title: "Remove?" });
```

## Learn more

- [Adapter parity](https://stainless-code.com/layers/adapters) · [Adapter hooks](https://stainless-code.com/layers/reference/adapter-hooks)
- [Concepts: lifecycle](https://stainless-code.com/layers/concepts/lifecycle) · [identity & types](https://stainless-code.com/layers/concepts/identity-and-types)
