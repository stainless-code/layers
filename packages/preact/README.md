# @stainless-code/preact-layers

Preact adapter for [@stainless-code/layers](https://github.com/stainless-code/layers#readme) — open any modal, dialog, drawer, popover, or toast from anywhere and manage it as an ordered, named stack.

Awaiting a typed result with `await client.open(...)` and fire-and-forget with `void client.open(...)` are equally first-class. Named stacks, singletons via `upsert` with live `update`, serial queues, nested stacks, transitions, blockers, and validation provide standalone value.

Engine concepts live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture guide](https://github.com/stainless-code/layers/blob/main/docs/architecture.md). Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/preact-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported — import both adapter hooks/components and core APIs from this one package. `preact` (>=10.19.0) is a required peer dependency (adapter uses `preact/compat` for `useSyncExternalStore`).

## Getting started

### 1. Declare a layer

```tsx
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

type ConfirmPayload = {
  title: string;
  message: string;
};

type ConfirmResponse = boolean;

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
import { StackProvider, StackOutlet } from "@stainless-code/preact-layers";

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}
```

### 3. Call and await

```tsx
import { useLayer } from "@stainless-code/preact-layers";
import { confirm } from "./confirm";

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

Low-level bag-form alternative: `useLayerClient()` + `client.open({ ...confirm, payload })`.

Payload and response are both optional. A no-payload, fire-and-forget layer
omits `payload`, does not `await` `open`, and dismisses without a response:

```tsx
import {
  layerOptions,
  type LayerComponentProps,
  useLayerClient,
} from "@stainless-code/preact-layers";

function SavedToast({ call }: LayerComponentProps<void>) {
  return (
    <div role="status">
      Saved
      <button type="button" onClick={() => void call.dismiss()}>
        Dismiss
      </button>
    </div>
  );
}

const savedToast = layerOptions<void>({
  key: ["toast", "saved"],
  component: SavedToast,
});

function SaveButton() {
  const client = useLayerClient();

  return (
    <button
      type="button"
      onClick={() => {
        saveItem();
        void client.open({ ...savedToast });
      }}
    >
      Save
    </button>
  );
}
```

## API

All imports from `@stainless-code/preact-layers`.

### Provider & client

| Export                 | Signature               | Role                                                                   |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------- |
| **`StackProvider`**    | `{ client?, children }` | Mount a `LayerClient` for the subtree (creates one lazily if omitted). |
| **`useLayerClient()`** | `() => LayerClient`     | Read the nearest client; call `client.open(...)`.                      |

### Wired handle & subscriptions

| Export                                                                 | Role                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| **`useLayer(options, client?)`**                                       | Drive + observe. See [glossary](../../docs/glossary.md). |
| **`useLayerState({ key, stack?, select?, compare? }, client?)`**       | Observe-only, mounted, `LayerState[]`.                   |
| **`useLayerQueuedState({ key, stack?, select?, compare? }, client?)`** | Observe-only, queued, `LayerState[]`.                    |
| **`useStack({ stack?, select?, compare? }, client?)`**                 | Whole-stack mounted snapshot.                            |
| **`useQueuedStack({ stack?, select?, compare? }, client?)`**           | Whole-stack queued snapshot.                             |
| **`StackSubscribe({ stack?, selector, children })`**                   | Render-prop subscription.                                |

```tsx
const c = useLayer(confirm);
const mounted = useLayerState({ key: confirm.key, stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
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

### Preact-specific types

`StackHandles`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `AppLayerProps<P, R>`, `StackHook<HostProps>`.

### Core re-exports

This package **`export *` from `@stainless-code/layers`** — includes `createLayer`, `LayerHandle`, `ValidatedLayerHandle`, and all other core APIs from the same path.

Engine concepts (transitions, blockers, validation, serial scope, `gcTime`) live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture doc](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
