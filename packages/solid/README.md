# @stainless-code/solid-layers

<p align="center">
  <img src="https://stainless-code.com/layers/icon.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Solid adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/solid-layers`

**Peer:** `solid-js` (`>=1.6.0`)

## Taste

```tsx
import {
  LayerClient,
  LayerClientContext,
  StackOutlet,
  layerOptions,
  useLayer,
  type LayerComponentProps,
} from "@stainless-code/solid-layers";

function ConfirmDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog">
      <h2>{props.payload.title}</h2>
      <button onClick={() => void props.call.end(true)}>Yes</button>
      <button onClick={() => void props.call.end(false)}>No</button>
    </div>
  );
}

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});
const client = new LayerClient();

function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="confirm" />
      <RemoveButton />
    </LayerClientContext.Provider>
  );
}

function RemoveButton() {
  const c = useLayer(confirm);

  async function handleRemove() {
    const ok = await c.open({ title: "Remove?", message: "Sure?" });
    if (!ok) return;
    deleteItem();
  }

  return (
    <button type="button" onClick={() => void handleRemove()}>
      Remove
    </button>
  );
}
```

## Docs

- [Solid adapter](https://stainless-code.com/layers/adapters/solid)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/solid)
