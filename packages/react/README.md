# @stainless-code/react-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. This React adapter for [@stainless-code/layers](https://github.com/stainless-code/layers#readme) supports awaiting a typed result and fire-and-forget invocation (`void client.open(...)`) as equally first-class choices.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each stand on their own. Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/react-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported — import both adapter hooks and core APIs (`LayerClient`, `layerOptions`, `LayerState`, `LayerComponentProps`, etc.) from this one package. `react` is a required peer dependency (you already have it; do not add it to the install line).

## Getting started

### 1. Declare a layer

```tsx
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/react-layers";

export type ConfirmPayload = { title: string; message: string };
export type ConfirmResponse = boolean;

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<ConfirmPayload, ConfirmResponse>) {
  return (
    <div role="dialog">
      <h2>{payload.title}</h2>
      <p>{payload.message}</p>
      <button type="button" onClick={() => void call.end(true)}>
        Yes
      </button>
      <button type="button" onClick={() => void call.end(false)}>
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
import { StackProvider, StackOutlet } from "@stainless-code/react-layers";

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}
```

### 3. Call and await

Response type `ConfirmResponse` is inferred from `confirm` — no explicit
generics on `open`.

```tsx
import { useLayerClient } from "@stainless-code/react-layers";
import { confirm } from "./confirm";

function RemoveButton() {
  const client = useLayerClient();

  async function handleRemove() {
    const ok: boolean = await client.open({
      ...confirm,
      payload: { title: "Remove?", message: "Sure?" },
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

Payload and response are both optional. A no-payload, fire-and-forget layer
omits `payload`, does not `await` `open`, and dismisses without a response:

```tsx
import {
  layerOptions,
  type LayerComponentProps,
  useLayerClient,
} from "@stainless-code/react-layers";

function Notice({ call }: LayerComponentProps) {
  return (
    <div role="status">
      Saved
      <button type="button" onClick={() => void call.dismiss()}>
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

All imports from `@stainless-code/react-layers`.

### Provider & client

| Export                 | Signature               | Role                                                                   |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------- |
| **`StackProvider`**    | `{ client?, children }` | Mount a `LayerClient` for the subtree (creates one lazily if omitted). |
| **`useLayerClient()`** | `() => LayerClient`     | Read the nearest client; call `client.open(...)`.                      |

### Subscriptions

- **`useStack(stackId?, selector?, compare?) => T`** — subscribe to a stack snapshot. The default selector returns `LayerState[]`; `compare` defaults to `Object.is` and preserves the previous selected reference when equal.
- **`useLayer(key, stackId?, compare?) => LayerState | null`** — subscribe to one layer by key; `null` when inactive. `DataTag` keys from `layerOptions` / `layerKey` infer response `R` and error `E`.
- **`StackSubscribe({ stack?, selector, children })`** — isolate a render-prop subscription and pass its selected value to `children`.

```tsx
const count = useStack("confirm", (states) => states.length);
const top = useStack("confirm", (states) => states.at(-1) ?? null);
```

### Rendering

- **`useStackHandles(stack?, rootProps?) => StackHandles`** — headless `{ states, getCall }` for custom hosts.
- **`StackOutlet({ stack?, rootProps? })`** — render active layers with their registered `component` and full props. A missing component renders nothing and warns in development.

### Nested stacks & async actions

- **`useLayerGroup(call, options?) => LayerGroup`** — child stack scoped to a parent layer's lifetime; auto-drains on parent dismiss. Returns `{ open, dismissAll, states, Outlet, stackId }`.
- **`useMutationFlow(call) => MutationFlow<R>`** — drive `actionStatus: "running"` during async work. `run(fn).orEnd(response)` ends on success, or leaves the layer open and rethrows on failure.

### App chrome factory

| Export                | Signature                                   | Role                                                                                                       |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`createStackHook`** | `({ stack?, client?, Host? }) => StackHook` | Bind stack id and optional host wrapper once. Returns `{ StackProvider, useAppStack, AppHost, AppLayer }`. |

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Its props become `rootProps`; an optional configured `Host` receives the same props and wraps the outlet.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`).

### React-specific types

`StackHandles`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `AppLayerProps<P, R>`, `StackHook<HostProps>`.

### Core re-exports

This package **`export *` from `@stainless-code/layers`** — core types and APIs (`LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerComponentProps`, `LayerCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, `ErrorOf`, validation helpers, etc.) import from the same path.

Engine concepts (transitions, blockers, validation, serial scope, `gcTime`) live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture doc](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
