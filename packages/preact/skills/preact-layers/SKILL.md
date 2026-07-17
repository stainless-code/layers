---
name: preact-layers
description: Preact adapter for @stainless-code/preact-layers — use for awaitable confirm flows, singleton toasts, nested drawers, stack subscriptions, and custom layer hosts
license: MIT
keywords:
  - tanstack-intent
  - preact
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/preact-layers"
  library_version: "0.2.0"
  framework: "preact"
sources:
  - https://stainless-code.com/layers/adapters/preact
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Preact layer/stack UI with @stainless-code/preact-layers

`@stainless-code/preact-layers` lets Preact code open any layer from anywhere and manage it as an ordered, named stack. Awaiting a typed result with `await client.open(...)` and fire-and-forget with `void client.open(...)` are equally first-class. Named stacks, singletons via `upsert` with live `update`, serial queues, nested stacks, transitions, blockers, and validation provide standalone value.

The adapter re-exports `@stainless-code/layers`; use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) for engine details. See the [architecture guide](https://github.com/stainless-code/layers/blob/main/docs/architecture.md) and [repository README](https://github.com/stainless-code/layers#readme) for the wider model.

## When to use this skill

Reach for `@stainless-code/preact-layers` to open overlay UI imperatively from anywhere and manage ordered, named stacks instead of prop-drilling `isOpen`, lifting state, or threading `onConfirm`.

It fits when you need any of:

- Open or close overlay UI from anywhere.
- Await a typed result or fire-and-forget; both are first-class.
- Named stacks, singletons via `upsert` plus live `update`, or one-at-a-time queues.
- Nested stacks via `useLayerGroup`, transitions, dismissal guards, validation, or headless rendering via `useStackHandles`.

Skip only for a single always-local overlay with no return, stacking, queue, animation, guard needs, and no wish for a global registry.

Full fit matrix: [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use).

## Install

```bash
bun add @stainless-code/preact-layers
```

Core is installed automatically. `preact` >=10.19.0 is a required peer; the adapter uses `preact/compat` for `useSyncExternalStore`.

## Declare → Mount → Call

```tsx
// 1. Declare a layer
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

export type ConfirmPayload = {
  title: string;
};

export type ConfirmResponse = boolean;

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<ConfirmPayload, ConfirmResponse>) {
  return (
    <div role="dialog">
      <h2>{payload.title}</h2>
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

```tsx
// 2. Mount the stack outlet once, high in the tree
import { StackProvider, StackOutlet } from "@stainless-code/preact-layers";

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}
```

```tsx
// 3. Call & await
import { useLayer } from "@stainless-code/preact-layers";
import { confirm } from "./confirm";

function Opener() {
  const c = useLayer(confirm);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok: boolean = await c.open({ title: "Remove?" });
        if (ok) deleteItem();
      }}
    >
      Remove
    </button>
  );
}
```

Low-level bag-form: `useLayerClient()` + `client.open({ ...confirm, payload })`.

## The `call` context

Each layer component receives `call` (`end`/`dismiss`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`/`addBlocker`), `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`. Use `await call.end(response)` to resolve the caller's `await` and dismiss the layer (`Promise<boolean>` — `false` if a blocker vetoes). `setRunning(true|false)` flips `actionStatus` manually; `useMutationFlow` (below) wraps `setRunning` + `end` for the common save-then-close case.

**Key vs id:** `key` is the logical identity (`find`/`upsert`/`gcTime`); each mount gets a unique instance `id`. Use `s.id` for list keys; `parallel` stacks may hold multiple same-key layers.

## Wired handle: useLayer

```tsx
const c = useLayer(confirm);
await c.open({ title: "Remove?" });
```

## Subscribing to stacks

### useStack / useQueuedStack

Options-bag + optional trailing `client`; `select` (not `selector`):

```tsx
const states = useStack({ stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
const queued = useQueuedStack({ stack: "confirm" });
```

### useLayerState / useLayerQueuedState

Observe-only; returns `LayerState[]` for all same-key instances:

```tsx
const states = useLayerState({ key: confirm.key, stack: "confirm" });
const top = states.at(-1);
```

### StackSubscribe

Isolate a subscription in a render-prop component and pass its selected value to `children`:

```tsx
import { StackSubscribe } from "@stainless-code/preact-layers";

<StackSubscribe stack="confirm" selector={(s) => s.length}>
  {(count) => <span>{count} open</span>}
</StackSubscribe>;
```

## Rendering layers

`StackOutlet` is the default host. It maps each state to its registered `component` with full props (`call`, `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`). A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in your own portal helper when you need a specific portal target; sidecar and nested-portal hosting are consumer concerns, not built into the adapter.

### Headless: useStackHandles

When you need custom hosts (switch by key, your own wrappers, alternate DOM slots):

```tsx
import { useStackHandles } from "@stainless-code/preact-layers";

function CustomHost() {
  const { states, getCall } = useStackHandles("modal");
  return states.map((s) =>
    s.key[0] === "sheet" ? (
      <Sheet key={s.id} call={getCall(s)} payload={s.payload} />
    ) : (
      <Dialog key={s.id} call={getCall(s)} payload={s.payload} />
    ),
  );
}
```

## Nested layers

Inside a layer component, `useLayerGroup(call)` owns a child stack scoped to the parent's lifetime — it auto-drains when the parent dismisses.

```tsx
import {
  useLayerGroup,
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

const nested = layerOptions<{ label: string }>({
  stack: "settings-nested",
  key: ["settings", "advanced"],
  component: AdvancedPanel,
});

function SettingsDrawer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call);
  return (
    <div role="dialog" aria-label={payload.title}>
      <button
        type="button"
        onClick={() =>
          void group.open({ ...nested, payload: { label: "Advanced" } })
        }
      >
        Open nested
      </button>
      <group.Outlet />
      <button type="button" onClick={() => void call.dismiss(false)}>
        Close
      </button>
    </div>
  );
}
```

Returns `{ open, dismissAll, states, Outlet, stackId }`. `open` pre-binds the child `stack` id.

## Async actions

Drive a layer's `actionStatus` while an async mutation runs, then end the layer on success:

```tsx
import {
  useMutationFlow,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

function ConfirmSave({
  call,
  payload,
}: LayerComponentProps<{ name: string }, boolean>) {
  const flow = useMutationFlow(call);
  return (
    <div role="dialog">
      <p>Save {payload.name}?</p>
      <button
        type="button"
        disabled={flow.pending}
        onClick={() =>
          void flow
            .run(async () => {
              await saveToServer(payload.name);
            })
            .orEnd(true)
        }
      >
        {flow.pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => void call.end(false)}>
        Cancel
      </button>
    </div>
  );
}
```

If the mutation throws, `orEnd` restores the idle status, leaves the layer open, and rethrows.

## App chrome: createStackHook

Bind a stack id, optional client, and optional host wrapper once:

```tsx
import {
  createStackHook,
  type LayerComponentProps,
} from "@stainless-code/preact-layers";

const { StackProvider, useAppStack, AppHost, AppLayer } = createStackHook({
  stack: "modal",
});

function SettingsDialog({ call }: LayerComponentProps) {
  return (
    <div role="dialog" aria-label="Settings">
      <button type="button" onClick={() => void call.dismiss()}>
        Close
      </button>
    </div>
  );
}

function App() {
  return (
    <StackProvider>
      <AppHost />
      <ModalTrigger />
    </StackProvider>
  );
}

function ModalTrigger() {
  const { open } = useAppStack();
  return (
    <button
      type="button"
      onClick={() =>
        void open({
          key: ["modal", "settings"],
          component: SettingsDialog,
        })
      }
    >
      Open settings
    </button>
  );
}
```

Here, payload and response are both optional: `open` omits `payload`, is not
awaited, and `SettingsDialog` dismisses without a response.

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Its props become `rootProps`; an optional configured `Host` receives the same props and the outlet as `children`.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`):

```tsx
function ControlledSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AppLayer
      options={settingsOpts}
      open={open}
      payload={{ title: "Settings" }}
      onResolved={() => onClose()}
    />
  );
}
```

## Adapter API

| Kind      | Name                   | Signature / shape                                                 |
| --------- | ---------------------- | ----------------------------------------------------------------- |
| Component | `StackProvider`        | `{ client?, children }`                                           |
| Hook      | `useLayerClient`       | `() => LayerClient`                                               |
| Hook      | `useLayer`             | `(options, client?) => WiredLayerHandle + state/queued/top`       |
| Hook      | `useLayerState`        | `({ key, stack?, select?, compare? }, client?) => LayerState[]`   |
| Hook      | `useLayerQueuedState`  | `({ key, stack?, select?, compare? }, client?) => LayerState[]`   |
| Hook      | `useStack`             | `({ stack?, select?, compare? }, client?) => T`                   |
| Hook      | `useQueuedStack`       | `({ stack?, select?, compare? }, client?) => T`                   |
| Hook      | `useStackHandles`      | `(stack?, rootProps?) => StackHandles`                            |
| Component | `StackOutlet`          | `{ stack?, rootProps? }`                                          |
| Component | `StackSubscribe`       | `{ stack?, selector, children }`                                  |
| Hook      | `useMutationFlow`      | `<P, R, RootProps?>(call) => MutationFlow<R>`                     |
| Hook      | `useLayerGroup`        | `<P, R, RootProps?>(call, options?) => LayerGroup`                |
| Factory   | `createStackHook`      | `<HostProps>({ stack?, client?, Host? }) => StackHook<HostProps>` |
| Type      | `StackHandles`         | `{ states, getCall }`                                             |
| Type      | `MutationRun<R>`       | `{ orEnd(response) }`                                             |
| Type      | `MutationFlow<R>`      | `{ pending, run }`                                                |
| Type      | `ScopedOpen`           | `open` with `stack` pre-bound                                     |
| Type      | `LayerGroup`           | `{ open, dismissAll, states, Outlet, stackId }`                   |
| Type      | `AppStack`             | `{ open, dismissAll, states }`                                    |
| Type      | `AppLayerProps<P, R>`  | `{ options, open, payload, onResolved? }`                         |
| Type      | `StackHook<HostProps>` | `{ StackProvider, useAppStack, AppHost, AppLayer }`               |

## Core re-exports (same import path)

Core exports are available from `@stainless-code/preact-layers`, including `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerComponentProps`, `LayerCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, and `ErrorOf`:

- **Key inference:** `layerOptions` / `layerKey` `DataTag` branding — `await client.open(...)` infers `R`.
- **Singleton + live updates:** `upsert: true` on `open`; `client.getStack(id).update(layer, patch)`.
- **Serial scope:** `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })`.
- **Validation:** `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` via `isPayloadValidationError`.
- **Blockers:** `call.addBlocker` / `stack.addBlocker`; `dismissing` flag; `dismissAll` modes.

See the [`layers`](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) skill for full engine coverage (transitions, blockers, validation, serial scope, multi-stack).
