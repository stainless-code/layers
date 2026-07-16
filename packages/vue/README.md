# @stainless-code/vue-layers

Open any layer from anywhere and manage overlay UI as an ordered, named stack. This Vue 3 adapter for [@stainless-code/layers](https://github.com/stainless-code/layers#readme) supports both typed results with `await client.open(...)` and equally first-class fire-and-forget calls with `void client.open(...)`, plus singletons via `upsert` and live `update`, serial queues, nested stacks via `useLayerGroup`, transitions, blockers, and validation.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/vue-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported — import adapter composables and core APIs from this one package. `vue` (>=3.3) is a required peer dependency (you already have it; do not add it to the install line).

## Getting started

### 1. Declare a layer

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

### 2. Mount a stack outlet

Call `provideLayerClient()` once in root `setup()`, then mount `<StackOutlet>` for each stack you need.

```vue
<!-- App.vue -->
<script setup lang="ts">
import { provideLayerClient, StackOutlet } from "@stainless-code/vue-layers";

provideLayerClient();
</script>

<template>
  <RouterView />
  <StackOutlet stack="confirm" />
</template>
```

Wrap `<StackOutlet>` in `<Teleport to="body">` when you need a portal target.

### 3. Call and await

```vue
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

Low-level bag-form alternative: `useLayerClient()` + `client.open({ ...confirm, payload })`.

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

## API

All imports from `@stainless-code/vue-layers`.

### Provider & client

| Export                   | Signature                  | Role                                                                                                 |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`provideLayerClient`** | `(client?) => LayerClient` | Provide a `LayerClient` via Vue provide/inject (creates one if omitted). Call in a parent `setup()`. |
| **`useLayerClient`**     | `() => LayerClient`        | Read the nearest client from inject; throws if none provided.                                        |

### Wired handle & subscriptions

Call inside `setup()` or an `effectScope()` — subscriptions clean up via `onScopeDispose`. Refs auto-unwrap in templates; use `.value` in `<script setup>`.

| Export                                                                 | Returns                              | Role                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| **`useLayer(options, client?)`**                                       | handle refs + `state`/`queued`/`top` | Drive + observe. See [glossary](../../docs/glossary.md).                 |
| **`useLayerState({ key, stack?, select?, compare? }, client?)`**       | `Readonly<Ref<LayerState[]>>`        | Observe-only, mounted.                                                   |
| **`useLayerQueuedState({ key, stack?, select?, compare? }, client?)`** | `Readonly<Ref<LayerState[]>>`        | Observe-only, queued.                                                    |
| **`useStack({ stack?, select?, compare? }, client?)`**                 | `Readonly<Ref<T>>`                   | Whole-stack mounted.                                                     |
| **`useQueuedStack({ stack?, select?, compare? }, client?)`**           | `Readonly<Ref<T>>`                   | Whole-stack queued.                                                      |
| **`StackSubscribe({ stack?, selector })`**                             | scoped slot                          | Slot `{ value: unknown }`; prefer `useStack({ select })` for typed refs. |

```vue
<script setup lang="ts">
import { useLayer, useLayerState, useStack } from "@stainless-code/vue-layers";
import { confirm } from "./confirm";

const c = useLayer(confirm);
const mounted = useLayerState({ key: confirm.key, stack: "confirm" });
const count = useStack({ stack: "confirm", select: (s) => s.length });
</script>
```

Optional trailing `client` overrides context client.

### Rendering

- **`useStackHandles(stack?, rootProps?) => StackHandles`** — headless `{ states, getCall }` for custom hosts. `states` is `Readonly<Ref<LayerState[]>>`.
- **`StackOutlet({ stack?, rootProps? })`** — render active layers with their registered `component` and full props. A missing component renders nothing and warns in development.

`StackOutlet` renders inline. Wrap it in `<Teleport>` when you need a portal target.

### Nested stacks & async actions

- **`useLayerGroup(call, options?) => LayerGroup`** — child stack scoped to a parent layer's lifetime; auto-drains on parent dismiss. Returns `{ open, dismissAll, states, Outlet, stackId }`.
- **`useMutationFlow(call) => MutationFlow<R>`** — drive `actionStatus: "running"` during async work. `run(fn).orEnd(response)` ends on success, or leaves the layer open and rethrows on failure. `pending` is `Readonly<Ref<boolean>>` — use `flow.pending.value` in script or `flow.pending` in templates.

### App chrome factory

| Export                | Signature                                   | Role                                                                                                       |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`createStackHook`** | `({ stack?, client?, Host? }) => StackHook` | Bind stack id and optional host wrapper once. Returns `{ StackProvider, useAppStack, AppHost, AppLayer }`. |

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound; `states` is a ref.
- **`AppHost`** — renders `StackOutlet` for the bound stack. Host props are forwarded via fallthrough attrs as `rootProps`; an optional configured `Host` receives the same attrs and wraps the outlet.
- **`AppLayer`** — controlled open/close via props (`open`, `payload`, `options`, `onResolved`).

### Vue-specific types

`StackHandles`, `StackSubscribeProps`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `AppLayerProps<P, R>`, `StackHook<HostProps>`.

### Core re-exports

`export * from "@stainless-code/layers"` — includes `createLayer`, `LayerHandle`, `ValidatedLayerHandle`, plus `LayerClient`, `layerOptions`, `LayerState`, validation helpers, and more.

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
