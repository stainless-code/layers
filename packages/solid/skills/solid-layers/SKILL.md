---
name: solid-layers
description: SolidJS adapter for @stainless-code/solid-layers; open UI from anywhere and manage ordered, named stacks with typed or fire-and-forget `open`
license: MIT
keywords:
  - tanstack-intent
  - solid
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/solid-layers"
  library_version: "0.1.0"
  framework: "solid"
sources:
  - https://stainless-code.com/layers/adapters/solid
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Solid layer/stack UI with @stainless-code/solid-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. `@stainless-code/solid-layers` is the SolidJS adapter for `@stainless-code/layers`; awaiting a typed result is optional, and fire-and-forget invocation (`void client.open(...)`) is equally first-class.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each provide standalone value. The package re-exports `@stainless-code/layers`, so adapter and core APIs share one import path. For engine internals, use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md).

## When to use this skill

- Reach for `@stainless-code/solid-layers` to open overlay UI imperatively from anywhere—components, effects, route guards, or non-UI code—and manage it as an ordered, named stack instead of prop-drilling, lifting state, or threading callbacks.
- It fits when you need any of: open/close from anywhere; await a typed result or fire-and-forget (both first-class); named/ordered stacks, singletons (`upsert`) with live `update`, or one-at-a-time queues; nested stacks (`useLayerGroup`), enter/exit animations, dismissal guards (blockers), payload validation, or headless rendering (`useStackHandles`).

**Skip it only when:** you have a single, always-local overlay opened from one component, with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use).

## Install

```bash
bun add @stainless-code/solid-layers
```

Core is included. `solid-js` (`>=1.6`) is a required peer; install it separately if the app does not provide it.

## Declare → Mount → Call

```tsx
// 1. Declare a layer
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/solid-layers";

export type ConfirmPayload = { title: string };
export type ConfirmResponse = boolean;

function ConfirmDialog(
  props: LayerComponentProps<ConfirmPayload, ConfirmResponse>,
) {
  return (
    <div role="dialog">
      <h2>{props.payload.title}</h2>
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

```tsx
// 2. Mount the stack outlet once, high in the tree
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

```tsx
// 3. Call & await
import { useLayer } from "@stainless-code/solid-layers";
import { confirm } from "./confirm";

function Opener() {
  const c = useLayer(confirm);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await c.open({ title: "Remove?" });
        if (ok) deleteItem();
      }}
    >
      Remove
    </button>
  );
}
```

Low-level bag-form: `useLayerClient()` + `client.open({ ...confirm, payload })`. Idiomatic `create*` aliases for observe/stack hooks (`createStack`, `createLayerState`, `createQueuedStack`, `createLayerQueuedState`). Wired handle stays `useLayer`; headless factory is core `createLayer`.

## The `call` context

Each layer component receives `call` (`end`/`dismiss`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`/`addBlocker`), `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, and `dismissing`. Use `await call.end(response)` to resolve the caller's `await` and dismiss the layer (`Promise<boolean>` — `false` if a blocker vetoes). `setRunning(true|false)` flips `actionStatus` manually; `useMutationFlow` (below) wraps `setRunning` + `end` for the common save-then-close case.

**Key vs id:** `key` is the logical identity (`find`/`upsert`/`gcTime`); each mount gets a unique instance `id`. `StackOutlet` keys by `id` so state changes update props in place; `parallel` stacks may hold multiple same-key layers.

## Wired handle: useLayer

```tsx
const c = useLayer(confirm);
await c.open({ title: "Remove?" });
// c.state() / c.queued() / c.top() — accessors
```

## Subscribing to stacks

Options-bag + optional trailing `client`; `select` (not `selector`). Call accessors inside JSX or `createEffect`.

### useStack / useQueuedStack

```tsx
const states = useStack({ stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
const queued = useQueuedStack({ stack: "confirm" });
```

### useLayerState / useLayerQueuedState

Observe-only; `Accessor<LayerState[]>` for all same-key instances:

```tsx
const states = useLayerState({ key: confirm.key, stack: "confirm" });
const top = () => states().at(-1);
```

### StackSubscribe

Isolate a subscription in a render-prop component; `children` receives an `Accessor<T>`:

```tsx
import { StackSubscribe } from "@stainless-code/solid-layers";

<StackSubscribe stack="confirm" selector={(s) => s.length}>
  {(count) => <span>{count()} open</span>}
</StackSubscribe>;
```

## Rendering layers

`StackOutlet` is the default host. It maps each state to its registered `component` with full props (`call`, `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`). Layers are keyed by `id` so state changes update props in place without remounting. A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in `Portal` from `solid-js/web` when you need a specific DOM target.

### Headless: useStackHandles

When you need custom hosts (switch by key, your own wrappers, alternate DOM slots):

```tsx
import { useStackHandles } from "@stainless-code/solid-layers";
import { For } from "solid-js";

function CustomHost() {
  const { states, getCall } = useStackHandles("modal");
  return (
    <For each={states()}>
      {(s) =>
        s.key[0] === "sheet" ? (
          <Sheet call={getCall(s)} payload={s.payload} />
        ) : (
          <Dialog call={getCall(s)} payload={s.payload} />
        )
      }
    </For>
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
} from "@stainless-code/solid-layers";

const nested = layerOptions<{ label: string }>({
  stack: "settings-nested",
  key: ["settings", "advanced"],
  component: AdvancedPanel,
});

function SettingsDrawer(
  props: LayerComponentProps<{ title: string }, boolean>,
) {
  const group = useLayerGroup(props.call);
  return (
    <div role="dialog" aria-label={props.payload.title}>
      <button
        type="button"
        onClick={() =>
          void group.open({ ...nested, payload: { label: "Advanced" } })
        }
      >
        Open nested
      </button>
      <group.Outlet />
      <button type="button" onClick={() => void props.call.dismiss(false)}>
        Close
      </button>
    </div>
  );
}
```

Returns `{ open, dismissAll, states, Outlet, stackId }`. `open` pre-binds the child `stack` id; `states` is an `Accessor<LayerState[]>`.

## Async actions

Drive a layer's `actionStatus` while an async mutation runs, then end the layer on success:

```tsx
import {
  useMutationFlow,
  type LayerComponentProps,
} from "@stainless-code/solid-layers";

function ConfirmSave(props: LayerComponentProps<{ name: string }, boolean>) {
  const flow = useMutationFlow(props.call);
  return (
    <div role="dialog">
      <p>Save {props.payload.name}?</p>
      <button
        type="button"
        disabled={flow.pending()}
        onClick={() =>
          void flow
            .run(async () => {
              await saveToServer(props.payload.name);
            })
            .orEnd(true)
        }
      >
        {flow.pending() ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => void props.call.end(false)}>
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
} from "@stainless-code/solid-layers";

const { StackProvider, useAppStack, AppHost, AppLayer } = createStackHook({
  stack: "modal",
});

function SettingsDialog(props: LayerComponentProps) {
  return (
    <div role="dialog" aria-label="Settings">
      <button type="button" onClick={() => void props.call.dismiss()}>
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

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound. `states` is an `Accessor<LayerState[]>`.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Its props become `rootProps`; an optional configured `Host` receives the same props and wraps the outlet.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`):

```tsx
function ControlledSettings(props: { open: boolean; onClose: () => void }) {
  return (
    <AppLayer
      options={settingsOpts}
      open={props.open}
      payload={{ title: "Settings" }}
      onResolved={() => props.onClose()}
    />
  );
}
```

## Adapter API

| Kind      | Name                   | Signature / shape                                                         |
| --------- | ---------------------- | ------------------------------------------------------------------------- |
| Context   | `LayerClientContext`   | `Context<LayerClient \| undefined>`                                       |
| Hook      | `useLayerClient`       | `() => LayerClient`                                                       |
| Hook      | `useLayer`             | `(options, client?) => WiredLayerHandle accessors + state/queued/top`     |
| Hook      | `useLayerState`        | `({ key, stack?, select?, compare? }, client?) => Accessor<LayerState[]>` |
| Hook      | `useLayerQueuedState`  | `({ key, stack?, select?, compare? }, client?) => Accessor<LayerState[]>` |
| Hook      | `useStack`             | `({ stack?, select?, compare? }, client?) => Accessor<T>`                 |
| Hook      | `useQueuedStack`       | `({ stack?, select?, compare? }, client?) => Accessor<T>`                 |
| Hook      | `useStackHandles`      | `(stack?, rootProps?) => StackHandles`                                    |
| Component | `StackOutlet`          | `{ stack?, rootProps? }`                                                  |
| Component | `StackSubscribe`       | `{ stack?, selector, children: (value: Accessor<T>) => JSX }`             |
| Hook      | `useMutationFlow`      | `<P, R, RootProps?>(call) => MutationFlow<R>`                             |
| Hook      | `useLayerGroup`        | `<P, R, RootProps?>(call, options?) => LayerGroup`                        |
| Factory   | `createStackHook`      | `<HostProps>({ stack?, client?, Host? }) => StackHook<HostProps>`         |
| Type      | `StackHandles`         | `{ states: Accessor<LayerState[]>, getCall }`                             |
| Type      | `MutationRun<R>`       | `{ orEnd(response) }`                                                     |
| Type      | `MutationFlow<R>`      | `{ pending: Accessor<boolean>, run }`                                     |
| Type      | `ScopedOpen`           | `open` with `stack` pre-bound                                             |
| Type      | `LayerGroup`           | `{ open, dismissAll, states, Outlet, stackId }`                           |
| Type      | `AppStack`             | `{ open, dismissAll, states }`                                            |
| Type      | `AppLayerProps<P, R>`  | `{ options, open, payload, onResolved? }`                                 |
| Type      | `StackHook<HostProps>` | `{ StackProvider, useAppStack, AppHost, AppLayer }`                       |

## Core re-exports (same import path)

Core exports are available from `@stainless-code/solid-layers`, including `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerComponentProps`, `LayerCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, and `ErrorOf`:

- **Key inference:** `layerOptions` / `layerKey` `DataTag` branding — `await client.open(...)` infers `R`.
- **Singleton + live updates:** `upsert: true` on `open`; `client.getStack(id).update(layer, patch)`.
- **Serial scope:** `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })`.
- **Validation:** `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` via `isPayloadValidationError`.
- **Blockers:** `call.addBlocker` / `stack.addBlocker`; `dismissing` flag; `dismissAll` modes.

See the [`layers`](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) skill for full engine coverage (transitions, blockers, validation, serial scope, multi-stack).
