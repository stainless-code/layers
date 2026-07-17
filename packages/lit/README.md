# @stainless-code/lit-layers

<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

Lit adapter — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: you own rendering, focus, portals, and a11y.

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
  layerOptions,
  type LayerCallContext,
} from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

defineStackElements();

interface ConfirmPayload {
  title: string;
}

@customElement("confirm-dialog")
class ConfirmDialog extends LitElement {
  // Light DOM so the dialog stacks with sibling overlays.
  createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  declare call: LayerCallContext<ConfirmPayload, boolean>;

  @property({ attribute: false })
  declare payload: ConfirmPayload;

  render() {
    return html`<div role="dialog">
      <h2>${this.payload.title}</h2>
      <button type="button" @click=${() => void this.call.end(true)}>
        Yes
      </button>
      <button type="button" @click=${() => void this.call.end(false)}>
        No
      </button>
    </div>`;
  }
}

const confirm = layerOptions<ConfirmPayload, boolean>({
  stack: "modal",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 200,
});

const client = new LayerClient();
const confirmLayer = createLayer(confirm, client);

async function remove() {
  const ok = await confirmLayer.open({ title: "Remove?" });
  // ^? boolean
}

// Shell:
// <stack-provider .client=${client}>
//   <stack-outlet stack="modal"></stack-outlet>
// </stack-provider>
```

`<stack-provider>` is shadow + `<slot>`; omit `client` on hooks to resolve from context after connect.

## Learn more

- [Adapter parity](https://stainless-code.com/layers/adapters) · [Adapter hooks](https://stainless-code.com/layers/reference/adapter-hooks)
- [Concepts: lifecycle](https://stainless-code.com/layers/concepts/lifecycle) · [identity & types](https://stainless-code.com/layers/concepts/identity-and-types)
