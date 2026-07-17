# @stainless-code/lit-layers

<!-- TODO: once the docs site (https://stainless-code.com/layers) is deployed, swap this src to https://stainless-code.com/layers/logo.svg for a stable, self-owned URL. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Lit adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/lit-layers`

**Peers:** `lit` (`>=3.2.0`), `@lit/context` (`>=1.1.0`)

## Taste

```ts
import {
  LayerClient,
  createLayer,
  defineStackElements,
  provideLayerClient,
  useStack,
  type LayerCallContext,
  type LayerComponentProps,
} from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

defineStackElements(); // registers <stack-provider> / <stack-outlet> / <stack-subscribe> / <app-host>

const client = new LayerClient();
const confirm = createLayer({
  key: ["confirm", "remove"],
  stack: "modal",
  component: ConfirmDialog,
  exitingDelay: 200,
});

@customElement("confirm-dialog")
class ConfirmDialog extends LitElement {
  // Light DOM so overlays stack inline where mounted.
  createRenderRoot() {
    return this;
  }
  declare call: LayerCallContext<{ title: string }, boolean>;
  declare payload: { title: string };
  render() {
    return html`<div role="dialog">
      <h2>${this.payload.title}</h2>
      <button @click=${() => void this.call.end(true)}>Yes</button>
      <button @click=${() => void this.call.end(false)}>No</button>
    </div>`;
  }
}

@customElement("app-root")
class AppRoot extends LitElement {
  #stack = useStack(this, { stack: "modal" }); // client resolved from context
  render() {
    return html`<button
      @click=${() => confirm(client).open({ title: "Remove?" })}
    >
      Remove
    </button>`;
  }
}

// Shell — provide once, high in the tree:
//   <stack-provider .client=${client}>
//     <app-root></app-root>
//     <stack-outlet stack="modal"></stack-outlet>
//   </stack-provider>
```

`provideLayerClient(host, client?)` / `<stack-provider .client=${...}>` supplies the client to descendants via `@lit/context`; omit `client` on any hook to resolve it from context. `useStack(this, { stack })` returns a controller whose `.current` mirrors the selected snapshot and requests updates on change.

## Learn more

- [Adapter parity](https://stainless-code.com/layers/adapters) · [Adapter hooks](https://stainless-code.com/layers/reference/adapter-hooks)
- [Concepts: lifecycle](https://stainless-code.com/layers/concepts/lifecycle) · [identity & types](https://stainless-code.com/layers/concepts/identity-and-types)
