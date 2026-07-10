---
name: react-layers
description: React adapter for @stainless-code/react-layers; open UI from anywhere and manage ordered, named stacks with typed or fire-and-forget `open`
license: MIT
keywords:
  - tanstack-intent
  - react
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/react-layers"
  library_version: "0.0.0"
  framework: "react"
sources:
  - https://github.com/stainless-code/layers/blob/main/packages/react/README.md
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# React layer/stack UI with @stainless-code/react-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. `@stainless-code/react-layers` is the React adapter for `@stainless-code/layers`; awaiting a typed result is optional, and fire-and-forget invocation (`void client.open(...)`) is equally first-class.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each provide standalone value. The package re-exports `@stainless-code/layers`, so adapter and core APIs share one import path. For engine internals, use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md).

## When to use this skill

- Reach for `@stainless-code/react-layers` to open overlay UI imperatively from anywhere—components, effects, route guards, or non-UI code—and manage it as an ordered, named stack instead of prop-drilling `isOpen`, lifting state, or threading `onConfirm` callbacks.
- It fits when you need any of: open/close from anywhere; await a typed result or fire-and-forget (both first-class); named/ordered stacks, singletons (`upsert`) with live `update`, or one-at-a-time queues; nested stacks (`useLayerGroup`), enter/exit animations, dismissal guards (blockers), payload validation, or headless rendering (`useStackHandles`).

**Skip it only when:** you have a single, always-local overlay opened from one component, with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/react-layers
```

Core is included. `react` is a required peer; install it separately if the app does not provide it.

## Declare → Mount → Call

```tsx
// 1. Declare a layer
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/react-layers";

export type ConfirmPayload = { title: string };
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
import { StackProvider, StackOutlet } from "@stainless-code/react-layers";

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}
```

```tsx
// 3. Call & await — response type (boolean) is inferred end-to-end
import { useLayerClient } from "@stainless-code/react-layers";
import { confirm } from "./confirm";

function Opener() {
  const client = useLayerClient();
  return (
    <button
      type="button"
      onClick={async () => {
        const ok: boolean = await client.open({
          ...confirm,
          payload: { title: "Remove?" },
        });
        if (ok) deleteItem();
      }}
    >
      Remove
    </button>
  );
}
```

## The `call` context

Each layer component receives `call` (`end`/`dismiss`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`/`addBlocker`), `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`. Use `await call.end(response)` to resolve the caller's `await` and dismiss the layer (`Promise<boolean>` — `false` if a blocker vetoes). `setRunning(true|false)` flips `actionStatus` manually; `useMutationFlow` (below) wraps `setRunning` + `end` for the common save-then-close case.

**Key vs id:** `key` is the logical identity (`find`/`upsert`/`gcTime`); each mount gets a unique instance `id`. Use `s.id` for React list keys; `parallel` stacks may hold multiple same-key layers.

## Subscribing to stacks

### useStack

```tsx
import { useStack } from "@stainless-code/react-layers";

function ConfirmList() {
  const states = useStack("confirm");
  return (
    <ul>
      {states.map((s) => (
        <li key={s.id}>{String(s.payload)}</li>
      ))}
    </ul>
  );
}
```

Optional `selector` and `compare` (default `Object.is`) limit re-renders when only a slice of the snapshot matters:

```tsx
const count = useStack("confirm", (states) => states.length);
const top = useStack("confirm", (states) => states.at(-1) ?? null);

// Custom equality — e.g. shallow compare a derived object
const summary = useStack(
  "confirm",
  (states) => ({ count: states.length, topKey: states.at(-1)?.key }),
  (a, b) => a.count === b.count && a.topKey === b.topKey,
);
```

### useLayer

Subscribe to a single layer by key; returns `null` when not active. A `DataTag` key (from `layerOptions` / `layerKey`) infers response `R` and error `E`:

```tsx
import { useLayer } from "@stainless-code/react-layers";
import { confirm, type ConfirmPayload } from "./confirm";

function ActiveConfirm() {
  // The key infers response/error; provide P when reading a typed payload.
  const state = useLayer<typeof confirm.key, ConfirmPayload>(
    confirm.key,
    "confirm",
  );
  if (!state) return null;
  return <span>{state.payload.title}</span>;
}
```

Optional third arg `compare` compares the previous and next matched `LayerState`. Unlike `useStack`, `useLayer` has no selector; use a custom comparison only when ignored state fields should not trigger a render.

### StackSubscribe

Isolate a subscription in a render-prop component and pass its selected value to `children`:

```tsx
import { StackSubscribe } from "@stainless-code/react-layers";

<StackSubscribe stack="confirm" selector={(s) => s.length}>
  {(count) => <span>{count} open</span>}
</StackSubscribe>;
```

## Rendering layers

`StackOutlet` is the default host. It maps each state to its registered `component` with full props (`call`, `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`). A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in your own `createPortal` if you need a specific portal target; sidecar and nested-portal hosting are consumer concerns, not built into the adapter.

### Headless: useStackHandles

When you need custom hosts (switch by key, your own wrappers, alternate DOM slots):

```tsx
import { useStackHandles } from "@stainless-code/react-layers";

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
} from "@stainless-code/react-layers";

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
} from "@stainless-code/react-layers";

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
} from "@stainless-code/react-layers";

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
| Hook      | `useStack`             | `<T>(stackId?, selector?, compare?) => T`                         |
| Hook      | `useLayer`             | `<Key, P?, D?>(key, stackId?, compare?) => LayerState \| null`    |
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

Core exports are available from `@stainless-code/react-layers`, including `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerComponentProps`, `LayerCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, and `ErrorOf`:

- **Key inference:** `layerOptions` / `layerKey` `DataTag` branding — `await client.open(...)` infers `R`.
- **Singleton + live updates:** `upsert: true` on `open`; `client.getStack(id).update(layer, patch)`.
- **Serial scope:** `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })`.
- **Validation:** `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` via `isPayloadValidationError`.
- **Blockers:** `call.addBlocker` / `stack.addBlocker`; `dismissing` flag; `dismissAll` modes.

See the [`layers`](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) skill for full engine coverage (transitions, blockers, validation, serial scope, multi-stack).
