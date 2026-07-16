# @stainless-code/svelte-layers

Open any layer from anywhere with `@stainless-code/svelte-layers` and manage modal, dialog, drawer, popover, and toast UI as ordered, named stacks. Await a typed result when the caller needs one, or fire-and-forget with `void client.open(...)`; both are first-class. Named stacks, singleton `upsert` with live `update`, serial queues, nested child stacks via `useLayerGroup`, async actions via `useMutationFlow`, transitions, blockers, and validation provide standalone value.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/svelte-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported from both entry points. `svelte` is a required peer dependency (you already have it; do not add it to the install line).

## Two entry points

| Import                                | Svelte version   | Reactivity                                                                                                                                                                                                          |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@stainless-code/svelte-layers`       | **5.7+** (runes) | `useStack` / `createLayer` → `SvelteStack` (`stack.current`, `stack.callFor`); `useMutationFlow` → `{ pending, run }` (`flow.pending` in markup); `useLayerGroup` → child `SvelteStack` via `group.stack`           |
| `@stainless-code/svelte-layers/store` | **3+** (stores)  | `useStack` / `createLayer` → `Readable<T>` (`$stack`); `useMutationFlow.pending` → `Readable<boolean>` (`$pending`); `useLayerGroup.stack` → `Readable<LayerState[]>`; standalone `callFor(client, stackId, state)` |

Pick **one entry per app** — do not mix runes and store bindings for the same stack surface.

## Getting started — runes (`@stainless-code/svelte-layers`)

### 1. Declare a layer

```ts
// layers/confirm.ts
import { layerOptions } from "@stainless-code/svelte-layers";
import ConfirmDialog from "./ConfirmDialog.svelte";

export type ConfirmPayload = {
  title: string;
};

export type ConfirmResponse = boolean;

export const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 200,
});
```

```svelte
<!-- ConfirmDialog.svelte -->
<script lang="ts">
  import type { LayerComponentProps } from "@stainless-code/svelte-layers";
  import type { ConfirmPayload, ConfirmResponse } from "./confirm";

  let { call, payload }: LayerComponentProps<ConfirmPayload, ConfirmResponse> =
    $props();
</script>

<div role="dialog">
  <h2>{payload.title}</h2>
  <button type="button" onclick={() => void call.end(true)}>Yes</button>
  <button type="button" onclick={() => void call.end(false)}>No</button>
</div>
```

### 2. Mount the stack outlet

There is no built-in outlet — render active layers yourself with `{#each}`.

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { setLayerClient, useStack } from "@stainless-code/svelte-layers";
  import { confirm } from "./layers/confirm";

  setLayerClient();
  const stack = useStack({ stack: "confirm" });
</script>

{#each stack.current as s (s.id)}
  {@const call = stack.callFor(s)}
  {#if call}
    {@const Comp = confirm.component}
    <Comp {call} payload={s.payload} phase={s.phase} actionStatus={s.actionStatus} />
  {/if}
{/each}
```

### 3. Call and await

```svelte
<script lang="ts">
  import { createLayer } from "@stainless-code/svelte-layers";
  import { confirm } from "./layers/confirm";

  const c = createLayer(confirm);

  async function handleRemove() {
    const ok = await c.open({ title: "Remove?" });
    if (!ok) return;
    deleteItem();
  }
</script>

<button type="button" onclick={() => void handleRemove()}>Remove</button>
```

Low-level bag-form alternative: `useLayerClient()` + `client.open({ ...confirm, payload })`.

## Getting started — stores (`@stainless-code/svelte-layers/store`)

Layer options and the call flow are the same, but store-based apps should import core APIs from `@stainless-code/svelte-layers/store`. In particular, change the declaration above to import `layerOptions` from the `/store` entry; importing the runes entry requires Svelte 5.7+. The outlet wiring differs, and Svelte 3/4 components use legacy syntax as shown below.

### 2. Mount the store outlet

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { setLayerClient, useStack, callFor } from "@stainless-code/svelte-layers/store";
  import { confirm } from "./layers/confirm";

  const client = setLayerClient();
  const stack = useStack({ stack: "confirm" });
</script>

{#each $stack as s (s.id)}
  {@const call = callFor(client, "confirm", s)}
  {#if call}
    <svelte:component
      this={confirm.component}
      {call}
      payload={s.payload}
      phase={s.phase}
      actionStatus={s.actionStatus}
    />
  {/if}
{/each}
```

With stores, `callFor` is a **standalone function** — it is not a method on the stack handle. The outlet keeps `<svelte:component>` because this entry targets Svelte 3+; the runes entry uses the Svelte 5 dynamic-component idiom (`<Comp/>`).

The layer declaration shape is shared, but the component above uses Svelte 5 syntax. In Svelte 3/4, declare props and events with legacy syntax:

```svelte
<script lang="ts">
  import type { LayerComponentProps } from "@stainless-code/svelte-layers/store";
  import type { ConfirmPayload, ConfirmResponse } from "./confirm";

  export let call: LayerComponentProps<
    ConfirmPayload,
    ConfirmResponse
  >["call"];
  export let payload: LayerComponentProps<
    ConfirmPayload,
    ConfirmResponse
  >["payload"];
</script>

<button type="button" on:click={() => void call.end(true)}>Yes</button>
<button type="button" on:click={() => void call.end(false)}>No</button>
```

When the payload admits `undefined`, omit `payload` from `open`; when the response is omitted, it defaults to `void`. This store-entry notice is both no-payload and fire-and-forget. Mount its `"notice"` stack with the store outlet pattern above.

```ts
// layers/notice.ts
import { layerOptions } from "@stainless-code/svelte-layers/store";
import Notice from "./Notice.svelte";

export const notice = layerOptions<void>({
  stack: "notice",
  key: ["notice"],
  component: Notice,
});
```

```svelte
<!-- Notice.svelte -->
<script lang="ts">
  import type { LayerComponentProps } from "@stainless-code/svelte-layers/store";

  export let call: LayerComponentProps<void>["call"];
</script>

<p>Changes saved.</p>
<button type="button" on:click={() => void call.dismiss()}>Dismiss</button>
```

```svelte
<!-- NoticeButton.svelte -->
<script lang="ts">
  import { useLayerClient } from "@stainless-code/svelte-layers/store";
  import { notice } from "./layers/notice";

  const client = useLayerClient();
</script>

<button type="button" on:click={() => void client.open(notice)}>
  Show notice
</button>
```

## Mutation flow & nested stacks

The adapter ships no `.svelte` outlet components — render active layers with `useStack().current` and `callFor` as above. `useMutationFlow` and `useLayerGroup` use the same compiler-free render path on both entries.

### `useMutationFlow` — runes

`useMutationFlow(call)` returns `{ pending, run }`. `pending` is a reactive `readonly boolean` — read `flow.pending` in markup or `$derived`. `run(fn).orEnd(response)` sets `actionStatus: "running"` while `fn` runs, ends the layer with `response` on success, or leaves it open and rethrows on failure.

```svelte
<!-- SaveDialog.svelte -->
<script lang="ts">
  import { type LayerComponentProps, useMutationFlow } from "@stainless-code/svelte-layers";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> = $props();
  const flow = useMutationFlow(call);
</script>

<div role="dialog" aria-label={payload.title}>
  <button
    type="button"
    disabled={flow.pending}
    onclick={() => void flow.run(() => save()).orEnd(true)}
  >
    Save
  </button>
</div>
```

### `useMutationFlow` — stores

Same `run(fn).orEnd(response)` contract; `pending` is a `Readable<boolean>` — bind it and auto-subscribe with `$pending`.

```svelte
<!-- SaveDialog.svelte -->
<script lang="ts">
  import { type LayerComponentProps, useMutationFlow } from "@stainless-code/svelte-layers/store";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> = $props();
  const { pending, run } = useMutationFlow(call);
</script>

<div role="dialog" aria-label={payload.title}>
  <button type="button" disabled={$pending} onclick={() => void run(() => save()).orEnd(true)}>
    Save
  </button>
</div>
```

### `useLayerGroup` — runes

`useLayerGroup(call, options?)` returns `{ open, dismissAll, stack, stackId }`. `stack` is a `SvelteStack` — render `{#each group.stack.current as s}` and pair each state with `group.stack.callFor(s)`. The child stack is disposed and dismissed on `onDestroy`.

```svelte
<!-- ParentDrawer.svelte -->
<script lang="ts">
  import { type LayerComponentProps, useLayerGroup } from "@stainless-code/svelte-layers";
  import { childLayer } from "./layers/child";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> = $props();
  const group = useLayerGroup(call);
</script>

<div role="dialog" aria-label={payload.title}>
  <h2>{payload.title}</h2>
  <button
    type="button"
    onclick={() =>
      void group.open({ ...childLayer, payload: { label: "Child" } })}
  >
    Open child
  </button>
  {#each group.stack.current as s (s.id)}
    {@const childCall = group.stack.callFor(s)}
    {#if childCall}
      {@const Comp = childLayer.component}
      <Comp
        call={childCall}
        payload={s.payload}
        phase={s.phase}
        actionStatus={s.actionStatus}
      />
    {/if}
  {/each}
</div>
```

### `useLayerGroup` — stores

`stack` is a `Readable<LayerState[]>`. Render `{#each $stack}` and pair each state with `callFor(client, group.stackId, s)`.

```svelte
<!-- ParentDrawer.svelte -->
<script lang="ts">
  import {
    callFor,
    type LayerComponentProps,
    useLayerClient,
    useLayerGroup,
  } from "@stainless-code/svelte-layers/store";
  import { childLayer } from "./layers/child";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> = $props();
  const client = useLayerClient();
  const group = useLayerGroup(call);
  const stack = group.stack;
</script>

<div role="dialog" aria-label={payload.title}>
  <h2>{payload.title}</h2>
  <button
    type="button"
    onclick={() =>
      void group.open({ ...childLayer, payload: { label: "Child" } })}
  >
    Open child
  </button>
  {#each $stack as s (s.id)}
    {@const childCall = callFor(client, group.stackId, s)}
    {#if childCall}
      <svelte:component
        this={childLayer.component}
        call={childCall}
        payload={s.payload}
        phase={s.phase}
        actionStatus={s.actionStatus}
      />
    {/if}
  {/each}
</div>
```

## API

### Runes entry (`@stainless-code/svelte-layers`) — complete adapter exports

| Export                                                 | Signature                                          | Role                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **`setLayerClient`**                                   | `(client?) => LayerClient`                         | Provide a `LayerClient` via Svelte context (creates one if omitted).                             |
| **`useLayerClient`**                                   | `() => LayerClient`                                | Read the nearest client from context.                                                            |
| **`createLayer(options, client?)`**                    | `SvelteStack` handle + `state`/`queued`/`top`      | Drive + observe.                                                                                 |
| **`createLayerState({ key, … }, client?)`**            | `SvelteStack<LayerState[]>`                        | Observe-only, mounted, all same-key.                                                             |
| **`createLayerQueuedState({ key, … }, client?)`**      | `SvelteStack<LayerState[]>`                        | Observe-only, queued.                                                                            |
| **`useStack({ stack?, select?, compare? }, client?)`** | `SvelteStack`                                      | Whole-stack mounted.                                                                             |
| **`createQueuedStack({ … }, client?)`**                | `SvelteStack`                                      | Whole-stack queued.                                                                              |
| **`useMutationFlow`**                                  | `(call) => MutationFlow<R>`                        | Coordinate async work with `actionStatus: "running"`; `run(fn).orEnd(response)` ends on success. |
| **`useLayerGroup`**                                    | `(call, options?) => LayerGroup`                   | Child stack scoped to the calling layer; `stack` is a `SvelteStack`; cleaned up on `onDestroy`.  |
| **`SvelteStack`**                                      | `{ readonly current, callFor(state, rootProps?) }` | Return type of `useStack` / `createLayerState` / `useLayerGroup.stack` on the runes entry.       |
| **`createLayerHandle`**                                | core `createLayer`                                 | Headless factory (core); adapter `createLayer` is the reactive wired handle.                     |
| **`MutationFlow<R>`**                                  | `{ readonly pending: boolean, run }`               | `pending` mirrors `actionStatus: "running"`; read `flow.pending` in markup.                      |
| **`MutationRun<R>`**                                   | `{ orEnd(response) => Promise<void> }`             | Ends the layer with `response` on success; on failure leaves it open and rethrows.               |
| **`LayerGroup`**                                       | `{ open, dismissAll, stack, stackId }`             | `open` is stack-pre-bound; `dismissAll(response?)` clears the child stack.                       |
| **`LayerComponentProps`**                              | type                                               | Props contract for layer components.                                                             |

```ts
const count = useStack({ stack: "confirm", select: (s) => s.length });
const mounted = createLayerState({ key: confirm.key, stack: "confirm" });
```

Read `stack.current` (or `layer.current`) inside reactive contexts. `stack.callFor(state, rootProps?)` builds each layer's `call` context.

### Stores entry (`@stainless-code/svelte-layers/store`) — complete adapter exports

| Export                                            | Signature                                                          | Role                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **`setLayerClient`**                              | `(client?) => LayerClient`                                         | Same context provider as the runes entry.                                                                |
| **`useLayerClient`**                              | `() => LayerClient`                                                | Same context reader.                                                                                     |
| **`useStack`**                                    | `({ stack?, select?, compare? }, client?) => Readable<T>`          | Whole-stack mounted store.                                                                               |
| **`createLayer(options, client?)`**               | wired handle store                                                 | Drive + observe.                                                                                         |
| **`createLayerState({ key, … }, client?)`**       | `Readable<LayerState[]>`                                           | Observe-only, mounted.                                                                                   |
| **`createLayerQueuedState({ key, … }, client?)`** | `Readable<LayerState[]>`                                           | Observe-only, queued.                                                                                    |
| **`createQueuedStack({ … }, client?)`**           | `Readable<T>`                                                      | Whole-stack queued.                                                                                      |
| **`useMutationFlow`**                             | `(call) => MutationFlow<R>`                                        | Same `run(fn).orEnd(response)` contract; `pending` is a `Readable<boolean>` (subscribe with `$pending`). |
| **`useLayerGroup`**                               | `(call, options?) => LayerGroup`                                   | Child stack store via `stack: Readable<LayerState[]>`; cleaned up on `onDestroy`.                        |
| **`callFor`**                                     | `(client, stackId, state, rootProps?) => LayerCallContext \| null` | Build a layer's `call` context; `null` if the layer is gone.                                             |
| **`MutationFlow<R>`**                             | `{ pending: Readable<boolean>, run }`                              | `pending` mirrors `actionStatus: "running"`.                                                             |
| **`MutationRun<R>`**                              | `{ orEnd(response) => Promise<void> }`                             | Ends on success; on failure leaves the layer open and rethrows.                                          |
| **`LayerGroup`**                                  | `{ open, dismissAll, stack, stackId }`                             | Render `$stack` with `callFor(client, stackId, s)`.                                                      |
| **`LayerComponentProps`**                         | type                                                               | Props contract for layer components.                                                                     |

### Core re-exports (both entries)

Both entries re-export core types (`export type *`) and a selective value set (`LayerClient`, `layerOptions`, `layerKey`, `createLayerHandle` [= core `createLayer`], `LayerStack`, …). Adapter **`createLayer`** is the Svelte-wired reactive handle — not the core factory (that is **`createLayerHandle`**).

Engine concepts (transitions, blockers, validation, serial scope, `gcTime`) live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture doc](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
