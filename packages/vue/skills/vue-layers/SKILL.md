---
name: vue-layers
description: Vue adapter for @stainless-code/vue-layers; open UI from anywhere and manage ordered, named stacks with typed or fire-and-forget `open`
license: MIT
keywords:
  - tanstack-intent
  - vue
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/vue-layers"
  library_version: "0.2.1"
  framework: "vue"
sources:
  - https://stainless-code.com/layers/adapters/vue
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Vue layer/stack UI with @stainless-code/vue-layers

Open any layer from anywhere and manage modal, dialog, drawer, popover, or toast UI as an ordered, named stack. `@stainless-code/vue-layers` is the Vue 3 adapter for `@stainless-code/layers`; awaiting a typed result is optional, and fire-and-forget invocation (`void client.open(...)`) is equally first-class.

Named stacks, singletons with `upsert` and live `update`, serial queues, nested stacks, transitions, dismissal blockers, payload validation, and headless rendering each provide standalone value. The package re-exports `@stainless-code/layers`, so adapter and core APIs share one import path. For engine internals, use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md).

## When to use this skill

- Reach for `@stainless-code/vue-layers` to open overlay UI imperatively from anywhere—components, composables, route guards, or non-UI code—and manage it as an ordered, named stack instead of prop-drilling `isOpen`, lifting state, or threading `onConfirm` callbacks.
- It fits when you need any of: open/close from anywhere; await a typed result or fire-and-forget (both first-class); named/ordered stacks, singletons (`upsert`) with live `update`, or one-at-a-time queues; nested stacks (`useLayerGroup`), enter/exit animations, dismissal guards (blockers), payload validation, or headless rendering (`useStackHandles`).

**Skip it only when:** you have a single, always-local overlay opened from one component, with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use).

## Install

```bash
bun add @stainless-code/vue-layers
```

Core is included. `vue` (>=3.3) is a required peer and should already be installed by the app.

## Declare → Mount → Call

```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";
import type { ConfirmPayload, ConfirmResponse } from "./confirm";

const { call, payload } =
  defineProps<LayerComponentProps<ConfirmPayload, ConfirmResponse>>();
</script>

<template>
  <div role="dialog">
    <h2>{{ payload.title }}</h2>
    <button type="button" @click="call.end(true)">Yes</button>
    <button type="button" @click="call.end(false)">No</button>
  </div>
</template>
```

```ts
// confirm.ts
import { layerOptions } from "@stainless-code/vue-layers";
import ConfirmDialog from "./ConfirmDialog.vue";

export type ConfirmPayload = { title: string };
export type ConfirmResponse = boolean;

export const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 200,
});
```

```vue
<!-- App.vue — mount the stack outlet once, high in the tree -->
<script setup lang="ts">
import { provideLayerClient, StackOutlet } from "@stainless-code/vue-layers";

provideLayerClient();
</script>

<template>
  <RouterView />
  <StackOutlet stack="confirm" />
</template>
```

```vue
<!-- Opener.vue -->
<script setup lang="ts">
import { useLayer } from "@stainless-code/vue-layers";
import { confirm } from "./confirm";

const c = useLayer(confirm);

async function handleRemove() {
  const ok = await c.open({ title: "Remove?" });
  if (!ok) return;
  deleteItem();
}
</script>

<template>
  <button type="button" @click="handleRemove()">Remove</button>
</template>
```

Low-level bag-form: `useLayerClient()` + `client.open({ ...confirm, payload })`.

`payload` is optional when its type is `void`, `unknown`, `undefined`, or a union containing `undefined`; responses default to `void`. This no-payload, fire-and-forget layer omits `payload`, does not await the returned promise, and dismisses without a response:

```vue
<!-- NoticeDialog.vue -->
<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

const { call } = defineProps<LayerComponentProps<void>>();
</script>

<template>
  <div role="status">
    Changes saved.
    <button type="button" @click="call.dismiss()">Close</button>
  </div>
</template>
```

```ts
// notice.ts
import { layerOptions } from "@stainless-code/vue-layers";
import NoticeDialog from "./NoticeDialog.vue";

export const notice = layerOptions<void>({
  stack: "notice",
  key: ["notice", "saved"],
  component: NoticeDialog,
});
```

```vue
<!-- FireAndForgetOpener.vue -->
<script setup lang="ts">
import { useLayerClient } from "@stainless-code/vue-layers";
import { notice } from "./notice";

const client = useLayerClient();

function showNotice() {
  void client.open(notice);
}
</script>

<template>
  <button type="button" @click="showNotice()">Save</button>
</template>
```

## The `call` context

Each layer component receives `call` (`end`/`dismiss`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`/`addBlocker`), `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`. Use `await call.end(response)` to resolve the caller's `await` and dismiss the layer (`Promise<boolean>` — `false` if vetoed). `setRunning(true|false)` flips `actionStatus` manually; `useMutationFlow` (below) wraps `setRunning` + `end` for the common save-then-close case.

**Key vs id:** `key` is the logical identity (`find`/`upsert`/`gcTime`); each mount gets a unique instance `id`. Use `s.id` for `v-for` keys; `parallel` stacks may hold multiple same-key layers.

## Wired handle: useLayer

```ts
const c = useLayer(confirm);
await c.open({ title: "Remove?" });
```

## Subscribing to stacks

### useStack / useQueuedStack

Options-bag + optional trailing `client`; `select` (not `selector`). Returns `Readonly<Ref<T>>`:

```vue
<script setup lang="ts">
import { useStack, useQueuedStack } from "@stainless-code/vue-layers";

const stack = useStack({ stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
const queued = useQueuedStack({ stack: "confirm" });
</script>
```

### useLayerState / useLayerQueuedState

Observe-only; `Readonly<Ref<LayerState[]>>` for all same-key instances:

```vue
<script setup lang="ts">
import { useLayerState } from "@stainless-code/vue-layers";
import { confirm } from "./confirm";

const states = useLayerState({ key: confirm.key, stack: "confirm" });
const top = computed(() => states.value.at(-1));
</script>
```

Optional `select` and `compare` (default `Object.is`) limit ref updates when only a slice matters.

### StackSubscribe

Isolate a subscription in a scoped-slot component. The slot payload is `{ value: unknown }` — prefer `useStack({ select })` in `setup()` for a fully typed ref:

```vue
<script setup lang="ts">
import { StackSubscribe } from "@stainless-code/vue-layers";
</script>

<template>
  <StackSubscribe stack="confirm" :selector="(s) => s.length">
    <template #default="{ value }">{{ value }} open</template>
  </StackSubscribe>
</template>
```

## Rendering layers

`StackOutlet` is the default host. It maps each state to its registered `component` with full props (`call`, `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`). A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in `<Teleport to="body">` when you need a portal target.

### Headless: useStackHandles

When you need custom hosts (switch by key, your own wrappers, alternate DOM slots):

```vue
<script setup lang="ts">
import { useStackHandles } from "@stainless-code/vue-layers";

const { states, getCall } = useStackHandles("modal");
</script>

<template>
  <template v-for="s in states" :key="s.id">
    <Sheet
      v-if="s.key[0] === 'sheet'"
      :call="getCall(s)"
      :payload="s.payload"
    />
    <Dialog v-else :call="getCall(s)" :payload="s.payload" />
  </template>
</template>
```

`states` is `Readonly<Ref<LayerState[]>>`; `getCall(state)` returns the layer's `LayerCallContext`.

## Nested layers

Inside a layer component, `useLayerGroup(call)` owns a child stack scoped to the parent's lifetime — it auto-drains when the parent dismisses.

```vue
<!-- SettingsDrawer.vue -->
<script setup lang="ts">
import {
  useLayerGroup,
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/vue-layers";
import AdvancedPanel from "./AdvancedPanel.vue";

const nested = layerOptions<{ label: string }>({
  key: ["settings", "advanced"],
  component: AdvancedPanel,
});

const { call, payload } =
  defineProps<LayerComponentProps<{ title: string }, boolean>>();
const group = useLayerGroup(call);
</script>

<template>
  <div role="dialog" :aria-label="payload.title">
    <button
      type="button"
      @click="group.open({ ...nested, payload: { label: 'Advanced' } })"
    >
      Open nested
    </button>
    <group.Outlet />
    <button type="button" @click="call.dismiss(false)">Close</button>
  </div>
</template>
```

Returns `{ open, dismissAll, states, Outlet, stackId }`. `open` pre-binds the child `stack` id.

## Async actions

Drive a layer's `actionStatus` while an async mutation runs, then end the layer on success:

```vue
<!-- ConfirmSave.vue -->
<script setup lang="ts">
import {
  useMutationFlow,
  type LayerComponentProps,
} from "@stainless-code/vue-layers";

const { call, payload } =
  defineProps<LayerComponentProps<{ name: string }, boolean>>();
const flow = useMutationFlow(call);

async function save() {
  await flow
    .run(async () => {
      await saveToServer(payload.name);
    })
    .orEnd(true);
}
</script>

<template>
  <div role="dialog">
    <p>Save {{ payload.name }}?</p>
    <button type="button" :disabled="flow.pending" @click="save()">
      {{ flow.pending ? "Saving…" : "Save" }}
    </button>
    <button type="button" @click="call.end(false)">Cancel</button>
  </div>
</template>
```

If the mutation throws, `orEnd` restores the idle status, leaves the layer open, and rethrows. `pending` is `Readonly<Ref<boolean>>` — use `flow.pending.value` in script or `flow.pending` in templates.

## App chrome: createStackHook

Bind a stack id, optional client, and optional host wrapper once:

```ts
// app-stack.ts
import { createStackHook } from "@stainless-code/vue-layers";

export const { StackProvider, useAppStack, AppHost, AppLayer } =
  createStackHook({ stack: "modal" });
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import SettingsDialog from "./SettingsDialog.vue";
import { StackProvider, AppHost } from "./app-stack";
</script>

<template>
  <StackProvider>
    <AppHost />
    <ModalTrigger />
  </StackProvider>
</template>
```

```vue
<!-- ModalTrigger.vue -->
<script setup lang="ts">
import SettingsDialog from "./SettingsDialog.vue";
import { useAppStack } from "./app-stack";

const { open } = useAppStack();
</script>

<template>
  <button
    type="button"
    @click="
      open({
        key: ['modal', 'settings'],
        component: SettingsDialog,
      })
    "
  >
    Open settings
  </button>
</template>
```

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound; `states` is a ref.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Host props are forwarded via fallthrough attrs as `rootProps`; an optional configured `Host` receives the same attrs and wraps the outlet.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`):

```vue
<script setup lang="ts">
import { AppLayer } from "./app-stack";
import { settingsOpts } from "./settings";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <AppLayer
    :options="settingsOpts"
    :open="open"
    :payload="{ title: 'Settings' }"
    :on-resolved="() => emit('close')"
  />
</template>
```

## Adapter API

| Kind      | Name                   | Signature / shape                                                              |
| --------- | ---------------------- | ------------------------------------------------------------------------------ |
| Function  | `provideLayerClient`   | `(client?: LayerClient) => LayerClient`                                        |
| Hook      | `useLayerClient`       | `() => LayerClient`                                                            |
| Hook      | `useLayer`             | `(options, client?) => WiredLayerHandle refs + state/queued/top`               |
| Hook      | `useLayerState`        | `({ key, stack?, select?, compare? }, client?) => Readonly<Ref<LayerState[]>>` |
| Hook      | `useLayerQueuedState`  | `({ key, stack?, select?, compare? }, client?) => Readonly<Ref<LayerState[]>>` |
| Hook      | `useStack`             | `({ stack?, select?, compare? }, client?) => Readonly<Ref<T>>`                 |
| Hook      | `useQueuedStack`       | `({ stack?, select?, compare? }, client?) => Readonly<Ref<T>>`                 |
| Hook      | `useStackHandles`      | `(stack?, rootProps?) => StackHandles`                                         |
| Component | `StackOutlet`          | `{ stack?, rootProps? }`                                                       |
| Component | `StackSubscribe`       | `{ stack?, selector }` — scoped slot `{ value: unknown }`                      |
| Hook      | `useMutationFlow`      | `<P, R, RootProps?>(call) => MutationFlow<R>`                                  |
| Hook      | `useLayerGroup`        | `<P, R, RootProps?>(call, options?) => LayerGroup`                             |
| Factory   | `createStackHook`      | `<HostProps>({ stack?, client?, Host? }) => StackHook<HostProps>`              |
| Type      | `StackHandles`         | `{ states: Readonly<Ref<LayerState[]>>, getCall }`                             |
| Type      | `MutationRun<R>`       | `{ orEnd(response) }`                                                          |
| Type      | `MutationFlow<R>`      | `{ pending: Readonly<Ref<boolean>>, run }`                                     |
| Type      | `ScopedOpen`           | `open` with `stack` pre-bound                                                  |
| Type      | `LayerGroup`           | `{ open, dismissAll, states, Outlet, stackId }`                                |
| Type      | `AppStack`             | `{ open, dismissAll, states }`                                                 |
| Type      | `AppLayerProps<P, R>`  | `{ options, open, payload, onResolved? }`                                      |
| Type      | `StackHook<HostProps>` | `{ StackProvider, useAppStack, AppHost, AppLayer }`                            |

Client-less subscriptions use `useLayerClient()` internally. Call `useStack`, `useLayer`, `useStackHandles`, `useMutationFlow`, and `useLayerGroup` inside `setup()` or `effectScope()`; subscriptions clean up via `onScopeDispose`.

## Core re-exports (same import path)

Core exports are available from `@stainless-code/vue-layers`, including `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerComponentProps`, `LayerCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, and `ErrorOf`:

- **Key inference:** `layerOptions` / `layerKey` `DataTag` branding — `await client.open(...)` infers `R`.
- **Singleton + live updates:** `upsert: true` on `open`; `client.getStack(id).update(layer, patch)`.
- **Serial scope:** `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })`.
- **Validation:** `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` via `isPayloadValidationError`.
- **Blockers:** `call.addBlocker` / `stack.addBlocker`; `dismissing` flag; `dismissAll` modes.

See the [`layers`](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) skill for full engine coverage (transitions, blockers, validation, serial scope, multi-stack).
