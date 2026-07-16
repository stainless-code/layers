---
name: layers
description: UI-agnostic layer stack engine for @stainless-code/layers. Use for opening layers imperatively from anywhere, ordered named stacks, typed await or fire-and-forget calls, lifecycle control, blockers, validation, singleton updates, serial or nested layers, multi-stack orchestration, or building a library/framework adapter.
license: MIT
keywords:
  - tanstack-intent
  - headless
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/layers"
  library_version: "0.1.0"
  framework: "framework-agnostic"
sources:
  - https://github.com/stainless-code/layers/blob/main/packages/core/README.md
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# @stainless-code/layers core engine

`@stainless-code/layers` is the headless, UI-agnostic engine for opening any layer from anywhere and managing it as an ordered, named stack. An app-wide `LayerClient` owns stack state and lifecycle; awaiting a typed result is optional, and `void client.open(...)` is equally first-class.

The [Angular](https://github.com/stainless-code/layers/blob/main/packages/angular/skills/angular-layers/SKILL.md), [Preact](https://github.com/stainless-code/layers/blob/main/packages/preact/skills/preact-layers/SKILL.md), [React](https://github.com/stainless-code/layers/blob/main/packages/react/skills/react-layers/SKILL.md), [Solid](https://github.com/stainless-code/layers/blob/main/packages/solid/skills/solid-layers/SKILL.md), [Svelte](https://github.com/stainless-code/layers/blob/main/packages/svelte/skills/svelte-layers/SKILL.md), and [Vue](https://github.com/stainless-code/layers/blob/main/packages/vue/skills/vue-layers/SKILL.md) adapters bind the engine to their library or framework's rendering model. All adapters have reached ergonomic parity; Angular and Svelte diverge by design — see [adapter ergonomics](https://github.com/stainless-code/layers/blob/main/docs/architecture.md#adapter-ergonomics).

## When to use this skill

Reach for `@stainless-code/layers` directly when building a library or framework adapter, or driving overlay or stack state in a headless, non-UI context. App developers usually install their library or framework adapter instead; it re-exports this core.

Use it to open layers imperatively from anywhere and manage ordered, named stacks. Await a typed result or fire-and-forget; both are first-class. Singletons via `upsert` with live `update`, serial one-at-a-time queues, nested or child stacks, transitions, dismissal blockers, validation, and `gcTime` each stand on their own.

Skip the core directly when an app only needs overlay UI and an adapter exists—install the adapter. Skip the whole library for a single, always-local overlay with no return, stacking, queue, animation, or guard needs.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/layers
```

Usually this package is pulled in by an adapter, which also re-exports the core API.

## Engine model

```text
LayerClient
  └── LayerStack[] (one observable stack per named surface)
        └── Layer[] (ordered state + caller-facing promise)
```

`LayerClient` owns named stacks, each `LayerStack` exposes immutable snapshots, and each `Layer` owns one instance's state and completion promise. An adapter observes snapshots and binds a call context; application code calls `open()` and awaits that promise.

## Quick start (core only)

```ts
import {
  LayerClient,
  layerOptions,
  createCallContext,
  type LayerStack,
} from "@stainless-code/layers";

type ConfirmPayload = { title: string };
type ConfirmResponse = boolean;

const client = new LayerClient();
const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
});

const stack = client.getStack("confirm") as LayerStack<
  ConfirmPayload,
  ConfirmResponse
>;
stack.subscribe(() => {
  for (const state of stack.getSnapshot()) {
    const layer = stack.getLayer(state.id)!;
    const call = createCallContext(stack, layer, state);
    // Bind state + call to a renderer; user actions call call.end(true/false).
  }
});

const ok = await client.open({
  ...confirm,
  payload: { title: "Remove item?" },
});
// ok: boolean
```

Payload and response are both optional. This fire-and-forget layer has neither;
its renderer resolves the call with `call.dismiss()`.

```ts
const maintenanceNotice = layerOptions<void>({
  stack: "notice",
  key: ["notice", "maintenance"],
});
const noticeStack = client.getStack("notice");

noticeStack.subscribe(() => {
  for (const state of noticeStack.getSnapshot()) {
    const layer = noticeStack.getLayer(state.id)!;
    const call = createCallContext(noticeStack, layer, state);
    void call.dismiss();
  }
});

void client.open(maintenanceNotice);
```

## Wired handles (`createLayer`)

For explicit-client / headless callers, `createLayer(options, client)` binds identity and returns a `LayerHandle` (or `ValidatedLayerHandle` when `options.validate` is set):

```ts
import { LayerClient, layerOptions, createLayer } from "@stainless-code/layers";

const client = new LayerClient();
const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
});

const c = createLayer(confirm, client);
const ok = await c.open({ title: "Remove?" });
c.dismiss(false, { id: c.current?.id });
```

Stack-level ops via `c.stack.*`. `current` is live-checked. Validated I/O: [glossary](../../../docs/glossary.md).

## Key inference

`layerOptions<P, R>(...)` is a zero-runtime, spreadable options helper; it has no `.call()` method. It brands `key` with `DataTag<Key, R, E>`, so `open()` infers the response and error types. To brand only a key:

```ts
import { layerKey } from "@stainless-code/layers";

const removeKey = layerKey<ConfirmResponse>()(["confirm", "remove"]);
const ok = await client.open({
  key: removeKey,
  stack: "confirm",
  payload: { title: "Remove?" },
});
//    ^? boolean
```

## The `call` context

`createCallContext` gives an active layer `end`, `dismiss`, `addBlocker`, `update`, `setRunning`, and `settle`, plus `ended`, `index`, `stackSize`, `root`, `stackId`, and `layerId`. `await call.end(response)` and `await call.dismiss(response)` request dismissal; when allowed, they resolve the caller and begin exit. Both return `Promise<boolean>`, with `false` meaning a blocker vetoed dismissal. `update` patches payload, `setRunning` controls `actionStatus`, and `settle` completes the current enter or exit transition.

`key` is logical identity for `find`, `upsert`, and `gcTime`; every mount gets a unique instance `id` shaped as `${hashKey(key)}#<n>`. `hashKey` and its alias `keySignature` compare keys structurally. Parallel stacks may contain multiple same-key instances.

## Lifecycle

The complete `phase` set is `pending`, `queued`, `active`, `dismissed`, and `error`. A `loadFn` starts at `pending`, receives `{ payload, signal }`, then moves to `active` with `data` or to `error` and rejects the caller; dismissal aborts in-flight loading. A serial-waiting layer is `queued` and not mounted.

Animation is an independent `transition` axis: `entering`, `settled`, or `exiting`. Dismissal resolves the caller, marks the layer `dismissed + exiting`, and removes it after `exitingDelay`. For either direction, the delay or `call.settle()`—whichever happens first—completes the transition.

## Guarding dismissal (blockers)

Gate user-intent dismissal with `call.addBlocker` for one instance or `stack.addBlocker` for stack policy. A blocker returning `true` allows dismissal; falsy, thrown, or rejected results veto it. Blockers may be async, including a nested confirmation:

```ts
call.addBlocker(async () =>
  !dirty
    ? true
    : await client.open({ ...confirm, payload: { title: "Discard?" } }),
);
```

`dismissing` is `true` while blockers run, and `{ force: true }` bypasses them. `stack.dismissAll(response, { mode })` supports `skipBlocked`, `stopAtBlocked`, and `force`; the default is `skipBlocked`, configurable per stack with `dismissAllMode` in `defaultStackOptions`. Teardown, unmount, and parent-child cascade force dismissal.

## Payload validation

Set `validate` on `layerOptions` or `open` to a `StandardSchemaV1` or synchronous parser `(input: unknown) => output`. Validation runs synchronously when opening, and the parsed output becomes the layer payload. Invalid input rejects the returned promise with `PayloadValidationError`; narrow it with `isPayloadValidationError` and read `issues: ReadonlyArray<ValidationIssue>`. Async schemas are unsupported and reject with an `Error`.

```ts
import { isPayloadValidationError } from "@stainless-code/layers";

try {
  await client.open({
    ...confirm,
    payload: raw,
    validate: (p) => parseConfirm(p),
  });
} catch (err) {
  if (isPayloadValidationError(err)) {
    /* show err.issues — ReadonlyArray<ValidationIssue> */
  }
}
```

The layer error type defaults to `DefaultLayerError`. Set it application-wide through `Register` module augmentation:

```ts
declare module "@stainless-code/layers" {
  interface Register {
    defaultError: AppError;
  }
}
```

## Singleton + live updates

```ts
const toast = client.getStack("toast");

// Reopening this key updates the existing instance instead of stacking.
const completion = client.open({
  stack: "toast",
  key: ["toast", "export"],
  upsert: true,
  payload: { msg: "Starting…" },
});

// Find by logical key and patch payload live.
const layer = toast.find(["toast", "export"])!;
toast.update(layer, { msg: "Done" });

await toast.dismiss(layer, undefined);
await completion;
```

## Serial scope + gcTime

```ts
const serialClient = new LayerClient({
  defaultStackOptions: {
    confirm: { scope: { strategy: "serial" }, gcTime: 5_000 },
  },
});
// only one confirm pending/active at a time; later open() queues (phase: "queued")
const stack = serialClient.getStack("confirm");
stack.getQueuedSnapshot(); // inspect queued layers
stack.cancelQueued(["confirm", "remove"], false); // FIFO head; pass `{ id }` for exact queued
```

Serial scope allows only one `pending` or `active` layer; later opens remain unmounted until their turn. `cancelQueued` resolves a waiting caller without mounting (FIFO, or `{ id }` for exact). `gcTime` caches dismissed data after removal, so reopening the same key restores `data` without rerunning `loadFn`.

## Nested layers

`createLayerGroup(client, call, options?)` creates a child stack scoped to its parent layer. Parent dismissal force-drains the child stack; `dispose()` removes the lifetime binding when the owner unmounts.

```ts
import { createLayerGroup } from "@stainless-code/layers";

const group = createLayerGroup(client, call, { name: "nested" });
await group.open({
  key: ["settings", "advanced"],
  payload: { label: "Advanced" },
});
group.dismissAll();
group.dispose();
```

`childStackId(call, name?)` derives `${parentStackId}~${parentLayerId}~${name}`.

## Multi-stack

Use `ensureStack(id, options?)` to materialize a configured surface, `getStackIds()` to enumerate materialized stacks, and `subscribeStacks(listener)` to observe newly created stacks. `LayerClient.dismissAll(stackId, response?, options?)` drains a named surface.

## Public API

The complete public API surface:

| Kind                             | Exports                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Engine classes                   | `LayerClient`, `LayerStack`, `Layer`                                                                                          |
| Infrastructure classes           | `Subscribable`, `ControlledPromise`                                                                                           |
| Validation class                 | `PayloadValidationError`                                                                                                      |
| Declaration and inference        | `layerOptions`, `layerKey`, `DataTag`, `InferDataTagResponse`, `InferDataTagError`, `ResponseOf`, `ErrorOf`                   |
| Wired handles                    | `createLayer`, `LayerHandle`, `ValidatedLayerHandle`                                                                          |
| Rendering seam                   | `createCallContext`, `LayerCallContext`, `LayerComponentProps`, `LayerComponent`                                              |
| Nested layers                    | `createLayerGroup`, `childStackId`, `LayerGroupOptions`, `LayerGroupHandle`                                                   |
| Identity and notification values | `hashKey`, `keySignature`, `notifyManager`                                                                                    |
| Validation API                   | `isPayloadValidationError`, `Validator`, `InferValidatorInput`, `InferValidatorOutput`, `StandardSchemaV1`, `ValidationIssue` |
| Layer model types                | `LayerKey`, `LayerPhase`, `LayerTransition`, `LayerActionStatus`, `LayerState`, `LayerOptions`, `OpenLayerOptions`            |
| Stack and client types           | `StackOptions`, `StackDefaults`, `LayerClientOptions`                                                                         |
| Dismissal types                  | `BlockerFn`, `StackBlockerFn`, `DismissOptions`, `DismissAllOptions`, `DismissAllMode`                                        |
| Utility and configuration types  | `Resolve`, `Reject`, `PayloadArg`, `OmitKeyof`, `Register`, `DefaultLayerError`                                               |

## Agnostic contract

Core never imports a UI library or framework. It leaves component rendering, reactivity bindings, hosts, and portals to consumers and adapters; `LayerComponent` is therefore `unknown` until an adapter narrows it.

See the [architecture](https://github.com/stainless-code/layers/blob/main/docs/architecture.md) for the full core-adapter boundary and the [repository README](https://github.com/stainless-code/layers#readme) for package entry points.
