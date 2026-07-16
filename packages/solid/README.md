# @stainless-code/solid-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. This SolidJS adapter for [@stainless-code/layers](https://github.com/stainless-code/layers#readme) supports awaiting a typed result and fire-and-forget invocation (`void client.open(...)`) as equally first-class choices.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each stand on their own. Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/solid-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported — import both adapter hooks and core APIs (`LayerClient`, `layerOptions`, `LayerState`, `LayerComponentProps`, etc.) from this one package. `solid-js` is a required peer dependency (`>=1.6`).

## Getting started

### 1. Declare a layer

```tsx
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/solid-layers";

export type ConfirmPayload = { title: string; message: string };
export type ConfirmResponse = boolean;

function ConfirmDialog(
  props: LayerComponentProps<ConfirmPayload, ConfirmResponse>,
) {
  return (
    <div role="dialog">
      <h2>{props.payload.title}</h2>
      <p>{props.payload.message}</p>
      <button type="button" onClick={() => void props.call.end(true)}>
        Yes
      </button>
      <button type="button" onClick={() => void props.call.end(false)}>
        No
      </button>
    </div>
  );
}

export const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 200,
});
```

### 2. Mount a stack outlet

```tsx
import {
  LayerClient,
  LayerClientContext,
  StackOutlet,
} from "@stainless-code/solid-layers";

const client = new LayerClient();

function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="confirm" />
    </LayerClientContext.Provider>
  );
}
```

### 3. Call and await

```tsx
import { useLayer } from "@stainless-code/solid-layers";
import { confirm } from "./confirm";

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

Low-level bag-form alternative: `useLayerClient()` + `client.open({ ...confirm, payload })`. Solid also exports idiomatic `create*` aliases for the observe/stack hooks (`createStack`, `createLayerState`, `createQueuedStack`, `createLayerQueuedState`) — not for the wired handle (`useLayer` / core `createLayer`).

Payload and response are both optional. A no-payload, fire-and-forget layer omits `payload`, does not `await` `open`, and dismisses without a response:

```tsx
import {
  layerOptions,
  type LayerComponentProps,
  useLayerClient,
} from "@stainless-code/solid-layers";

function Notice(props: LayerComponentProps) {
  return (
    <div role="status">
      Saved
      <button type="button" onClick={() => void props.call.dismiss()}>
        Close
      </button>
    </div>
  );
}

const notice = layerOptions({
  key: ["notice", "saved"],
  component: Notice,
});

function SaveNoticeButton() {
  const client = useLayerClient();

  return (
    <button type="button" onClick={() => void client.open(notice)}>
      Show saved notice
    </button>
  );
}
```

## API

All imports from `@stainless-code/solid-layers`.

### Provider & client

| Export                   | Signature                           | Role                                                                                        |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| **`LayerClientContext`** | `Context<LayerClient \| undefined>` | Solid context for the app client; wrap with `<LayerClientContext.Provider value={client}>`. |
| **`useLayerClient()`**   | `() => LayerClient`                 | Read the nearest client from context; throws if no provider.                                |

`createStackHook` also returns a **`StackProvider`** that wraps `LayerClientContext.Provider` for a bound stack.

### Wired handle & subscriptions

| Export                                                 | Returns                                    | Role                                                              |
| ------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| **`useLayer(options, client?)`**                       | `Accessor` handle + `state`/`queued`/`top` | Drive + observe. Core **`createLayer`** re-exported for headless. |
| **`useLayerState({ key, … }, client?)`**               | `Accessor<LayerState[]>`                   | Observe-only, mounted. **`createLayerState`** alias.              |
| **`useLayerQueuedState({ key, … }, client?)`**         | `Accessor<LayerState[]>`                   | Observe-only, queued. **`createLayerQueuedState`** alias.         |
| **`useStack({ stack?, select?, compare? }, client?)`** | `Accessor<T>`                              | Whole-stack mounted. **`createStack`** alias.                     |
| **`useQueuedStack({ … }, client?)`**                   | `Accessor<T>`                              | Whole-stack queued. **`createQueuedStack`** alias.                |
| **`StackSubscribe({ stack?, selector, children })`**   | render-prop                                | `children` receives `Accessor<T>`.                                |

```tsx
const c = useLayer(confirm);
const mounted = useLayerState({ key: confirm.key, stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
```

Read accessors inside reactive scopes — call `mounted()` in JSX or `createEffect`.

### Rendering

- **`useStackHandles(stack?, rootProps?) => StackHandles`** — headless `{ states, getCall }` for custom hosts. `states` is an `Accessor<LayerState[]>`.
- **`StackOutlet({ stack?, rootProps? })`** — render active layers with their registered `component` and full props. Layers are keyed by `id` so state changes update props in place without remounting. A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in `Portal` from `solid-js/web` when you need a specific DOM target.

### Nested stacks & async actions

- **`useLayerGroup(call, options?) => LayerGroup`** — child stack scoped to a parent layer's lifetime; auto-drains on parent dismiss. Returns `{ open, dismissAll, states, Outlet, stackId }`. `states` is an `Accessor<LayerState[]>`.
- **`useMutationFlow(call) => MutationFlow<R>`** — drive `actionStatus: "running"` during async work. `pending` is an `Accessor<boolean>`; call `flow.pending()`. `run(fn).orEnd(response)` ends on success, or leaves the layer open and rethrows on failure.

### App chrome factory

| Export                | Signature                                   | Role                                                                                                       |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`createStackHook`** | `({ stack?, client?, Host? }) => StackHook` | Bind stack id and optional host wrapper once. Returns `{ StackProvider, useAppStack, AppHost, AppLayer }`. |

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound. `states` is an `Accessor<LayerState[]>`.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Its props become `rootProps`; an optional configured `Host` receives the same props and wraps the outlet.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`).

### Solid-specific types

`StackHandles`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `AppLayerProps<P, R>`, `StackHook<HostProps>`.

### Core re-exports

This package **`export *` from `@stainless-code/layers`** — includes `createLayer`, `LayerHandle`, `ValidatedLayerHandle`, and all other core APIs from the same path.

Engine concepts (transitions, blockers, validation, serial scope, `gcTime`) live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture doc](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
