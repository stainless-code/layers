---
name: svelte-layers
description: Svelte bindings for @stainless-code/svelte-layers (runes + stores). Use to open overlay UI imperatively from anywhere, manage ordered named stacks, choose the Svelte 5.7+ runes or Svelte 3+ stores entry, and wire layer context or stack outlets.
license: MIT
keywords:
  - tanstack-intent
  - svelte
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/svelte-layers"
  library_version: "0.1.0"
  framework: "svelte"
sources:
  - https://github.com/stainless-code/layers/blob/main/packages/svelte/README.md
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Svelte layer/stack UI with @stainless-code/svelte-layers

Open any layer from anywhere with `client.open()` and manage modal, dialog, drawer, popover, and toast UI as ordered, named stacks. Awaiting a typed result and fire-and-forget with `void client.open(...)` are equally first-class; named stacks, singleton `upsert` with live `update`, serial queues, nested child stacks via `useLayerGroup`, async actions via `useMutationFlow`, transitions, blockers, and validation are valuable independently.

Both entries re-export `@stainless-code/layers`, so adapter and core APIs share one import path. Use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) for engine behavior.

## When to use this skill

Reach for `@stainless-code/svelte-layers` to open overlay UI imperatively from anywhere and manage ordered, named stacks instead of prop-drilling, lifting state, or threading callbacks. It fits when you need any of:

- Open or close layers from anywhere.
- Await a typed result or fire-and-forget; both are first-class.
- Named stacks, singleton `upsert` with live `update`, or serial queues.
- Nested child stacks via `useLayerGroup`, transitions, dismissal guards, or validation.

Skip it only for a single, always-local overlay with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/svelte-layers
```

Core is pulled in automatically. `svelte` is a required peer.

## Two entry points

| Entry                                 | Requires        | Pick it when                                                                              |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `@stainless-code/svelte-layers`       | Svelte **5.7+** | The app uses runes and Svelte 5 reactive component syntax.                                |
| `@stainless-code/svelte-layers/store` | Svelte **3+**   | The app uses the store contract, including Svelte 3/4 or a Svelte 5 store-based codebase. |

Choose one entry for a stack surface. The runes entry depends on `createSubscriber` from `svelte/reactivity`; the stores entry depends on `readable` from `svelte/store`.

## Declare → Mount → Call

### Declare

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

### Mount — runes

```svelte
<script lang="ts">
  import { setLayerClient, useStack } from "@stainless-code/svelte-layers";
  import { confirm } from "./layers/confirm";

  setLayerClient();
  const stack = useStack("confirm");
</script>

{#each stack.current as s (s.id)}
  {@const call = stack.callFor(s)}
  {#if call}
    {@const Comp = confirm.component}
    <Comp
      {call}
      payload={s.payload}
      data={s.data}
      error={s.error}
      phase={s.phase}
      transition={s.transition}
      actionStatus={s.actionStatus}
      dismissing={s.dismissing}
    />
  {/if}
{/each}
```

### Mount — stores

In a store-based app, keep the declaration shape above but import `layerOptions`
from `@stainless-code/svelte-layers/store`; importing the default runes entry
requires Svelte 5.7+.

```svelte
<script lang="ts">
  import { setLayerClient, useStack, callFor } from "@stainless-code/svelte-layers/store";
  import { confirm } from "./layers/confirm";

  const client = setLayerClient();
  const stack = useStack("confirm");
</script>

{#each $stack as s (s.id)}
  {@const call = callFor(client, "confirm", s)}
  {#if call}
    <svelte:component
      this={confirm.component}
      {call}
      payload={s.payload}
      data={s.data}
      error={s.error}
      phase={s.phase}
      transition={s.transition}
      actionStatus={s.actionStatus}
      dismissing={s.dismissing}
    />
  {/if}
{/each}
```

The runes outlet uses the Svelte 5 dynamic-component idiom (`{@const Comp = confirm.component}` then `<Comp />`) and its stack handle's `.callFor`. The stores outlet may use `<svelte:component>` for Svelte 3/4 compatibility and the standalone `callFor`.

The component and call snippets use Svelte 5 syntax. With Svelte 3/4, use legacy `export let` props and `on:click` events; see the [package README](https://github.com/stainless-code/layers/tree/main/packages/svelte#readme) for a complete example.

### Call

```svelte
<script lang="ts">
  import { useLayerClient } from "@stainless-code/svelte-layers";
  import { confirm } from "./layers/confirm";

  const client = useLayerClient();

  async function handleRemove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    if (!ok) return;
    deleteItem();
  }
</script>

<button type="button" onclick={() => void handleRemove()}>Remove</button>
```

Response type is inferred from `layerOptions` / `layerKey` `DataTag` branding.

When `P` admits `undefined`, `payload` is optional; omit it instead of passing an empty or `undefined` value. With the default `void` response, a layer can also be fire-and-forget. Mount its `"notice"` stack with the runes outlet pattern above.

```ts
// layers/notice.ts
import { layerOptions } from "@stainless-code/svelte-layers";
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
  import type { LayerComponentProps } from "@stainless-code/svelte-layers";

  let { call }: LayerComponentProps<void> = $props();
</script>

<p>Changes saved.</p>
<button type="button" onclick={() => void call.dismiss()}>Dismiss</button>
```

```svelte
<!-- NoticeButton.svelte -->
<script lang="ts">
  import { useLayerClient } from "@stainless-code/svelte-layers";
  import { notice } from "./layers/notice";

  const client = useLayerClient();
</script>

<button type="button" onclick={() => void client.open(notice)}>
  Show notice
</button>
```

## The `call` context

Call `setLayerClient()` or `setLayerClient(existingClient)` in a parent layout/root component. Descendants use `useLayerClient()` to read that `LayerClient`; it throws when no client exists in context.

Each layer component receives:

- `call`: `end`, `dismiss`, `update`, `setRunning`, `settle`, `ended`, `index`, `stackSize`, `root`, `stackId`, `layerId`, and `addBlocker`
- state props: `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, and `dismissing`

`await call.end(response)` resolves the caller's `await` and dismisses the layer. It returns `Promise<boolean>`; `false` means a blocker vetoed dismissal.

`key` is logical identity for operations such as `find`, `upsert`, and `gcTime`; every mount gets a unique `id`. Key `{#each}` blocks with `s.id`, because parallel stacks may contain multiple same-key layers.

### Transitions

Key CSS on `transition`; the configured delay or `call.settle()` completes the transition, whichever happens first:

```svelte
<div
  role="dialog"
  data-transition={transition}
  ontransitionend={() => call.settle()}
>
  <h2>{payload.title}</h2>
</div>
```

Set `enteringDelay` / `exitingDelay` on `layerOptions`. For spring or variable-duration exits, combine a generous `exitingDelay` cap with `ontransitionend`.

### Rendering location

The adapter has no built-in outlet, portal host, `StackOutlet`, `StackSubscribe`, or `createStackHook`. Render active layers inline in a layout with `useStack().current` and `callFor`, or move them with the app's portal pattern; nested child stacks from `useLayerGroup` follow the same render path.

## Subscribing to stacks

### useStack

Runes return a `SvelteStack` handle: read `.current` in a reactive context and use `.callFor(state, rootProps?)` for a mounted state.

```svelte
<script lang="ts">
  import { useStack } from "@stainless-code/svelte-layers";

  const stack = useStack("confirm");
</script>

<p>{stack.current.length} open</p>
```

Optional `selector` and `compare` (default `Object.is`) limit updates when only a slice matters:

```svelte
<script lang="ts">
  const count = useStack("confirm", (states) => states.length);
  const top = useStack("confirm", (states) => states.at(-1) ?? null);
</script>

<p>Count: {count.current}</p>
```

Stores return a `Readable`; use `$stack` to auto-subscribe and standalone `callFor(client, stackId, state, rootProps?)` for a mounted state.

```svelte
<script lang="ts">
  import { setLayerClient, useStack, callFor } from "@stainless-code/svelte-layers/store";

  const client = setLayerClient();
  const stackStore = useStack("confirm");
</script>

{#each $stackStore as s (s.id)}
  {@const call = callFor(client, "confirm", s)}
  ...
{/each}
```

Both forms accept optional `selector` and `compare` arguments; `compare` defaults to `Object.is`.

### useLayer

Subscribe to one layer by key. The selected state is `null` while inactive; `DataTag` branding from `layerOptions` / `layerKey` infers response and error types.

```svelte
<script lang="ts">
  import { useLayer } from "@stainless-code/svelte-layers";
  import { confirm } from "./layers/confirm";

  const layer = useLayer(confirm.key, "confirm");
</script>

{#if layer.current}
  <span>{layer.current.payload.title}</span>
{/if}
```

For stores, import `useLayer` from `@stainless-code/svelte-layers/store` and read the returned `Readable` with `$layer`.

## Mutation flow

`useMutationFlow(call)` coordinates a layer's `actionStatus: "running"` with async work. `run(fn).orEnd(response)` ends the layer on success; on failure it stays open and the error rethrows.

### Runes

`pending` is a reactive `readonly boolean` — read `flow.pending` in markup.

```svelte
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

### Stores

`pending` is a `Readable<boolean>` — destructure from the hook and subscribe with `$pending`.

```svelte
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

## Nested stacks

`useLayerGroup(call, options?)` creates a child stack scoped to the calling layer's lifetime. Returns `{ open, dismissAll, stack, stackId }`. The group is disposed and all child layers dismissed on `onDestroy`. Render child layers inline with the group's stack handle — there is no `StackOutlet`, `StackSubscribe`, or `createStackHook`.

### Runes

`stack` is a `SvelteStack` — `{#each group.stack.current as s}` + `group.stack.callFor(s)`.

```svelte
<script lang="ts">
  import { type LayerComponentProps, useLayerGroup } from "@stainless-code/svelte-layers";
  import { childLayer } from "./layers/child";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> = $props();
  const group = useLayerGroup(call);
</script>

<div role="dialog" aria-label={payload.title}>
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
      <Comp call={childCall} payload={s.payload} phase={s.phase} actionStatus={s.actionStatus} />
    {/if}
  {/each}
</div>
```

### Stores

`stack` is a `Readable<LayerState[]>` — `{#each $stack}` + `callFor(client, group.stackId, s)`.

```svelte
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

## Adapter API

| API               | Runes entry                                                                                                    | Stores entry                                                                       | Role                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `setLayerClient`  | `(client?) => LayerClient`                                                                                     | Same                                                                               | Put a provided or new client in Svelte context.                             |
| `useLayerClient`  | `() => LayerClient`                                                                                            | Same                                                                               | Read the nearest client; throws when absent.                                |
| `useStack`        | `(client, stackId?, selector?, compare?)` or `(stackId?, selector?, compare?) => SvelteStack<RootProps, T>`    | Same overloads returning `Readable<T>`                                             | Subscribe to a stack; the default selector returns `LayerState[]`.          |
| `useLayer`        | `(client, key, stackId?, compare?)` or `(key, stackId?, compare?) => SvelteStack<unknown, LayerState \| null>` | Same overloads returning `Readable<LayerState \| null>`                            | Subscribe to one keyed layer.                                               |
| `useMutationFlow` | `(call) => { readonly pending: boolean, run }`                                                                 | `(call) => { pending: Readable<boolean>, run }`                                    | Drive `actionStatus: "running"`; `run(fn).orEnd(response)` ends on success. |
| `useLayerGroup`   | `(call, options?) => { open, dismissAll, stack: SvelteStack, stackId }`                                        | `(call, options?) => { open, dismissAll, stack: Readable<LayerState[]>, stackId }` | Child stack scoped to the calling layer; cleaned up on `onDestroy`.         |
| `SvelteStack`     | `{ readonly current: T; callFor(state, rootProps?) }`                                                          | —                                                                                  | Reactive runes handle.                                                      |
| `callFor`         | —                                                                                                              | `(client, stackId, state, rootProps?) => LayerCallContext \| null`                 | Build a call context; returns `null` if the layer is gone.                  |
| `MutationFlow<R>` | `{ readonly pending: boolean, run }`                                                                           | `{ pending: Readable<boolean>, run }`                                              | `pending` mirrors `actionStatus: "running"`.                                |
| `MutationRun<R>`  | `{ orEnd(response) => Promise<void> }`                                                                         | Same                                                                               | Ends on success; on failure leaves the layer open and rethrows.             |
| `LayerGroup`      | `{ open, dismissAll, stack: SvelteStack, stackId }`                                                            | `{ open, dismissAll, stack: Readable<LayerState[]>, stackId }`                     | `open` is stack-pre-bound; `dismissAll(response?)` clears the child stack.  |

## Core re-exports (same import path)

Both entries use `export * from "@stainless-code/layers"` and additionally expose adapter types including `LayerComponentProps`, `SvelteStack`, `MutationFlow<R>`, `MutationRun<R>`, and `LayerGroup`. The core surface includes `LayerClient`, `LayerStack`, `Layer`, `layerOptions`, `layerKey`, `LayerState`, `LayerCallContext`, `createCallContext`, `createLayerGroup`, `childStackId`, `keySignature`, `hashKey`, `DataTag`, `ResponseOf`, `ErrorOf`, `PayloadValidationError`, `isPayloadValidationError`, and related types.

Common core patterns:

- **Key inference:** `layerOptions` / `layerKey` branding makes `await client.open(...)` infer its response.
- **Singleton and live updates:** set `upsert: true` on `open`; update with `client.getStack(id).update(layer, patch)`.
- **Serial scope:** configure `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })`.
- **Validation:** set `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` with `isPayloadValidationError`.
- **Blockers:** use `call.addBlocker` / `stack.addBlocker`, `dismissing`, and `dismissAll` modes.
- **Nested stacks:** `useLayerGroup(call, options?)` wraps core `createLayerGroup` with Svelte lifetime cleanup; `childStackId` remains available for manual wiring.

See the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) for full engine coverage, the [architecture guide](https://github.com/stainless-code/layers/blob/main/docs/architecture.md) for package boundaries, and the [repository README](https://github.com/stainless-code/layers#readme) for project-level setup.
