# @stainless-code/preact-layers

<p align="center">
  <img src="https://stainless-code.com/layers/icon.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Preact adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

[![bundle size](https://deno.bundlejs.com/?q=@stainless-code/preact-layers&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22preact%22%5D%7D%7D&badge=detailed)](https://bundlejs.com/?q=@stainless-code/preact-layers&config=%7B%22esbuild%22%3A%7B%22external%22%3A%5B%22preact%22%5D%7D%7D)

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/preact-layers`

**Peer:** `preact` (`>=10.19.0`)

## Taste

```tsx
import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog">
      <h2>{payload.title}</h2>
      <button onClick={() => void call.end(true)}>Yes</button>
      <button onClick={() => void call.end(false)}>No</button>
    </div>
  );
}

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
      <RemoveButton />
    </StackProvider>
  );
}

function RemoveButton() {
  const c = useLayer(confirm);

  async function handleRemove() {
    const ok: boolean = await c.open({
      title: "Remove?",
      message: "Sure?",
    });
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

- [Preact adapter](https://stainless-code.com/layers/adapters/preact)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/preact)
