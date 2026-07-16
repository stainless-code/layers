# Layers

<!-- TODO: once the docs site (https://stainless-code.com/layers) is deployed, swap this src to https://stainless-code.com/layers/logo.svg for a stable, self-owned URL. -->
<p align="center">
  <img src="https://raw.githubusercontent.com/stainless-code/layers/main/apps/docs/public/logo.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

Headless layer/stack manager — modals, dialogs, drawers, popovers, toasts are **layers in named stacks**. Open any layer from anywhere and `await` a typed result. A zero-dependency core plus React, Preact, Solid, Angular, Vue, and Svelte adapters. State coordination, not UI ownership: Layers owns ordering, keys, transitions, blockers, and the `await client.open(...)` contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version. ([Stability & versioning](https://stainless-code.com/layers/concepts/stability))

Full docs: [stainless-code.com/layers](https://stainless-code.com/layers).

## Packages

| Package                                              | Peer            | Install                                  |
| ---------------------------------------------------- | --------------- | ---------------------------------------- |
| [`@stainless-code/layers`](packages/core)            | —               | `bun add @stainless-code/layers`         |
| [`@stainless-code/react-layers`](packages/react)     | `react`         | `bun add @stainless-code/react-layers`   |
| [`@stainless-code/preact-layers`](packages/preact)   | `preact`        | `bun add @stainless-code/preact-layers`  |
| [`@stainless-code/vue-layers`](packages/vue)         | `vue`           | `bun add @stainless-code/vue-layers`     |
| [`@stainless-code/solid-layers`](packages/solid)     | `solid-js`      | `bun add @stainless-code/solid-layers`   |
| [`@stainless-code/svelte-layers`](packages/svelte)   | `svelte`        | `bun add @stainless-code/svelte-layers`  |
| [`@stainless-code/angular-layers`](packages/angular) | `@angular/core` | `bun add @stainless-code/angular-layers` |

Install only the adapter for your framework — it pulls the core in transitively and re-exports it, so adapter APIs (`StackProvider`, `useStack`, …) and core APIs (`LayerClient`, `layerOptions`, …) both come from the one package. Each adapter lists its framework as a required peer. Svelte ships two entries: `@stainless-code/svelte-layers` (runes, 5.7+) and `@stainless-code/svelte-layers/store` (stores, 3+).

## Taste (React)

```tsx
import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  type LayerComponentProps,
} from "@stainless-code/react-layers";

type ConfirmPayload = { title: string };
type ConfirmResponse = boolean;

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<ConfirmPayload, ConfirmResponse>) {
  return (
    <div role="dialog">
      <h2>{payload.title}</h2>
      <button onClick={() => void call.end(true)}>Yes</button>
      <button onClick={() => void call.end(false)}>No</button>
    </div>
  );
}

const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

function useRemove() {
  const client = useLayerClient();
  return async () => {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  };
}
```

## Docs

- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Concepts](https://stainless-code.com/layers/concepts)
- [Adapters](https://stainless-code.com/layers/adapters)
- [Reference](https://stainless-code.com/layers/reference)
- [Changelog](https://stainless-code.com/layers/changelog)

## Develop

This is a [bun workspaces](https://bun.sh/docs/install/workspaces) monorepo; root scripts fan out across packages with `bun run --filter '*' <script>`.

```bash
bun install
bun run check          # build (core-first) + format + lint + test + test:dom + typecheck
```

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) to contribute and [`AGENTS.md`](AGENTS.md) for agent instructions.

## License

MIT.
