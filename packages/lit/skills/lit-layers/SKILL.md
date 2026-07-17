---
name: lit-layers
description: Lit adapter for @stainless-code/lit-layers; open UI from anywhere and manage ordered, named stacks with typed or fire-and-forget `open` via Reactive Controllers and custom elements
license: MIT
keywords:
  - tanstack-intent
  - lit
  - web-components
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/lit-layers"
  library_version: "0.1.0"
  framework: "lit"
sources:
  - https://stainless-code.com/layers/adapters/lit
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Lit layer/stack UI with @stainless-code/lit-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. `@stainless-code/lit-layers` is the Lit adapter for `@stainless-code/layers`; awaiting a typed result is optional, and fire-and-forget invocation (`void client.open(...)`) is equally first-class.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each provide standalone value. The package re-exports `@stainless-code/layers`, so adapter and core APIs share one import path. For engine internals, use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md).

## When to use this skill

- Reach for `@stainless-code/lit-layers` to open overlay UI imperatively from anywhere — custom elements, controllers, or non-UI code — and manage it as an ordered, named stack instead of prop-drilling `isOpen`, lifting state, or threading `onConfirm` callbacks.
- It fits when you need any of: open/close from anywhere; await a typed result or fire-and-forget (both first-class); named/ordered stacks, singletons (`upsert`) with live `update`, or one-at-a-time queues; nested stacks (`useLayerGroup`), enter/exit animations, dismissal guards (blockers), payload validation, or headless rendering (`useStackHandles`).

**Skip it only when:** you have a single, always-local overlay opened from one component, with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use).

## Install

```bash
bun add @stainless-code/lit-layers
```

Core is included. `lit` (>=3.2.0) and `@lit/context` (>=1.1.0) are required peers and should already be installed by the app.

## Binding model

Binding: Reactive Controllers + `requestUpdate`. Host-first factories — `useStack(this, { stack })`, `useLayer(this, options, client?)`. `.current` mirrors the selected snapshot and requests a host update on change. `<stack-provider>` is shadow + `<slot>`; outlet / subscribe / `app-host` are light DOM.

```ts
import { useStack } from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("open-count")
class OpenCount extends LitElement {
  #stack = useStack(this, { stack: "confirm", select: (s) => s.length });
  render() {
    return html`<p>${this.#stack.current} open</p>`;
  }
}
```

## Declare → Mount → Call

```ts
// confirm-dialog.ts
import {
  layerOptions,
  type LayerCallContext,
} from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("confirm-dialog")
export class ConfirmDialog extends LitElement {
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

export const confirm = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 200,
});
```

```ts
// shell.ts — register the CEs and mount the outlet once, high in the tree
import {
  defineStackElements,
  provideLayerClient,
  LayerClient,
} from "@stainless-code/lit-layers";

defineStackElements(); // stack-provider, stack-outlet, stack-subscribe, app-host
const client = new LayerClient();
```

```html
<stack-provider .client="${client}">
  <my-app></my-app>
  <stack-outlet stack="confirm"></stack-outlet>
</stack-provider>
```

```ts
// opener.ts
import { createLayer } from "@stainless-code/lit-layers";
import { confirm } from "./confirm-dialog";

const c = createLayer(confirm, client);
async function handleRemove() {
  const ok = await c.open({ title: "Remove?" });
  if (!ok) return;
  deleteItem();
}
```

Low-level bag-form: `client.open({ ...confirm, payload })`.

`provideLayerClient(host, client?)` / `<stack-provider .client=${...}>` supplies the client to descendants via `@lit/context`; omit `client` on any hook to resolve it from context. `useLayerClient(host)` returns a controller whose `.current` throws when no provider has supplied a client.

## Primitives

Options bag plus optional trailing `LayerClient`. **Drive** with `useLayer(this, options, client?)`; **observe** with `useLayerState(this, { key, ... }, client?)`.

| Export                                                             | Role                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `useStack(host, { stack?, select?, compare? }, client?)`           | `StackController<T>` — `.current` mirrors the selected stack slice                      |
| `useQueuedStack(host, { ... }, client?)`                           | `StackController<T>` over the queued snapshot                                           |
| `useLayer(host, options, client?)`                                 | **Drive** — wired handle + `open()` / `dismiss()` + reactive `state` / `queued` / `top` |
| `useLayerState(host, { key, stack?, select?, compare? }, client?)` | **Observe** — mounted same-key layers                                                   |
| `useLayerQueuedState(host, { key, ... }, client?)`                 | **Observe** — queued same-key layers                                                    |

`useLayer` resolves the client lazily — omit `client` to resolve it from a `provideLayerClient()` / `<stack-provider>` ancestor after the host connects; the wired handle builds on first method access. Pass `client` explicitly for synchronous access at construction.

## Ergonomic APIs

| Export                                               | Role                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `useStackHandles(host, stack?, rootProps?, client?)` | `{ states, getCall }` for headless rendering                                            |
| `StackSubscribe` CE                                  | `<stack-subscribe .selector .renderer>` — `.renderer(value)` returns a `TemplateResult` |
| `useMutationFlow(host, call)`                        | `pending: boolean`; `run(fn).orEnd(response)`                                           |
| `useLayerGroup(host, call, options?, client?)`       | Child stack with `outlet(): TemplateResult` + `stackId`                                 |
| `createStackHook(config?)`                           | `StackProvider`, `useAppStack(host)`, `AppHost` CE, `AppLayer` controller               |

`StackOutlet` and `LayerGroup.outlet()` render each layer with its registered `component` — a `LitElement` constructor or a `(props) => TemplateResult` render function (no tag strings in v1). Id-keyed `repeat` keeps element instances stable across updates. `defineStackElements()` is idempotent and not auto-invoked on import.

## Learn more

- [Lifecycle](https://stainless-code.com/layers/concepts/lifecycle) · [Identity & types](https://stainless-code.com/layers/concepts/identity-and-types)
- [Adapter parity](https://stainless-code.com/layers/adapters) · [Adapter hooks](https://stainless-code.com/layers/reference/adapter-hooks)
