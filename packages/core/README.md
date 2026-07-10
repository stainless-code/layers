# @stainless-code/layers

Headless, UI-agnostic engine for opening any layer from anywhere and managing it as an ordered, named stack. An app-wide `LayerClient` owns stack state and lifecycle; awaiting a typed result is optional, and `void client.open(...)` is equally first-class.

Adapters bind the engine to a specific UI library or framework — `@stainless-code/react-layers`, `@stainless-code/preact-layers`, `@stainless-code/svelte-layers`, `@stainless-code/vue-layers`, `@stainless-code/solid-layers`, `@stainless-code/angular-layers` — and each depends on and re-exports this package.

## Install

```bash
bun add @stainless-code/layers
```

Usually you install an adapter instead; it pulls this package in as a dependency.

## When to use

Reach for the core directly when building a library or framework adapter, or driving overlay or stack state in a headless, non-UI context. App developers usually install their library or framework adapter instead; it re-exports this core.

Use it to open layers imperatively from anywhere and manage ordered, named stacks. Await a typed result or fire-and-forget; both are first-class. Singletons via `upsert` with live `update`, serial one-at-a-time queues, nested or child stacks, transitions, dismissal blockers, validation, and `gcTime` each stand on their own.

Skip the core directly when an app only needs overlay UI and an adapter exists—install the adapter. Skip the whole library for a single, always-local overlay with no return, stacking, queue, animation, or guard needs.

## Quick start

```ts
import {
  LayerClient,
  layerOptions,
  layerKey,
  createCallContext,
  isPayloadValidationError,
} from "@stainless-code/layers";

type ConfirmPayload = { title: string };
type ConfirmResponse = boolean;

const client = new LayerClient({
  defaultStackOptions: {
    confirm: { scope: { strategy: "serial" }, gcTime: 5_000 },
  },
});

// Brand a reusable definition — response type (boolean) flows into open()
const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  enteringDelay: 200,
  exitingDelay: 200,
});

// Or brand a key alone
const removeKey = layerKey<ConfirmResponse>()(["confirm", "remove"]);

// Observe stack snapshots (adapters bind this to UI reactivity)
const stack = client.getStack("confirm");
const unsubStack = stack.subscribe(() => {
  for (const state of stack.getSnapshot()) {
    const layer = stack.getLayer(state.id)!;
    const call = createCallContext(stack, layer, state);
    // render state + call in your UI; call.end(response) resolves the caller's await
  }
});

client.subscribeStacks((stackId) => {
  /* new stack materialized */
});

try {
  const ok = await client.open({
    ...confirm,
    payload: { title: "Remove item?" },
    validate: (input: unknown) => {
      const title =
        typeof input === "object" && input !== null && "title" in input
          ? input.title
          : undefined;
      if (typeof title !== "string" || !title.trim()) {
        throw new Error("Title required");
      }
      return { title };
    },
  });
  // ok: boolean — inferred from layerOptions DataTag
} catch (err) {
  if (isPayloadValidationError(err)) {
    /* err.issues */
  }
}

unsubStack();
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

## Engine model

```text
LayerClient
  ├── ensureStack / getStack / getStackIds / subscribeStacks / dismissAll
  └── LayerStack (per named surface)
        ├── getSnapshot / getQueuedSnapshot / subscribe
        └── Layer[] (ordered; each has state + promise)
```

1. **Declare** — `layerOptions<P, R>({ stack, key, ... })` brands the key with a `DataTag` for response inference.
2. **Observe** — subscribe to a stack snapshot; use `createCallContext(stack, layer, state)` to wire `call.end` / `call.dismiss` in your renderer.
3. **Call** — `await client.open({ ...options, payload })`; resolution happens when something calls `call.end(response)` or `stack.dismiss(layer, response)`.

## Public API

### Classes

| Export                       | Role                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`LayerClient`**            | App-wide orchestrator. `open()`, `getStack()`, `getStackIds()`, `subscribeStacks()`, `dismissAll()`, `ensureStack()`, `bindChildStack()`                                                                          |
| **`LayerStack`**             | One named surface. `getSnapshot()`, `getQueuedSnapshot()`, `subscribe()`, `getLayer()`, `find()`, `open()`, `dismiss()`, `dismissAll()`, `addBlocker()`, `update()`, `setRunning()`, `settle()`, `cancelQueued()` |
| **`Layer`**                  | One frame: `id`, `key`, `state`, `promise` (`ControlledPromise<R>`), `abortController`, `addBlocker()`, `setRunning()`, `resolve()` / `reject()` / `abort()`                                                      |
| **`Subscribable`**           | Base subscription primitive (`subscribe()`, `size`) used by stacks                                                                                                                                                |
| **`ControlledPromise<T>`**   | Promise with external `resolve` / `reject` (`Resolve`, `Reject` types)                                                                                                                                            |
| **`PayloadValidationError`** | Thrown when `validate` fails at `open`                                                                                                                                                                            |

### Functions

| Export                                 | Role                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **`layerOptions()`**                   | Brand a reusable options object; `key` carries a `DataTag` so `open()` infers `R` / `E`    |
| **`layerKey()`**                       | Brand a key alone: `layerKey<R>()(key)`                                                    |
| **`createCallContext()`**              | Build the imperative `call` handle (`end`, `dismiss`, `update`, `settle`, `addBlocker`, …) |
| **`createLayerGroup()`**               | Child stack scoped to a parent layer's lifetime (`open`, `dismissAll`, `dispose`)          |
| **`childStackId()`**                   | Derive a collision-free child stack id from a parent `call`                                |
| **`hashKey()`** / **`keySignature()`** | Stable string identity for a `LayerKey`                                                    |
| **`isPayloadValidationError()`**       | Narrow `PayloadValidationError`                                                            |
| **`notifyManager`**                    | `{ batch, batchCalls }` — dedupe notifications inside a batch                              |

### Key inference (`DataTag`)

`layerOptions` / `layerKey` brand keys at compile time only. Helpers: **`DataTag`**, **`InferDataTagResponse`**, **`InferDataTagError`**, **`ResponseOf`**, **`ErrorOf`**.

### Payload validation

Optional `validate` on `layerOptions` or `open` — a **`StandardSchemaV1`** schema or sync **`Validator`** fn (`(input: unknown) => output`, throws on invalid). Parsed synchronously at `open`; failure rejects with **`PayloadValidationError`** (`issues: ReadonlyArray<ValidationIssue>`). Input/output inference: **`InferValidatorInput`**, **`InferValidatorOutput`**.

### App-wide error typing

Augment **`Register`** to set **`DefaultLayerError`** once:

```ts
declare module "@stainless-code/layers" {
  interface Register {
    defaultError: AppError;
  }
}
```

### Layer & stack options (types)

**`LayerOptions`**, **`OpenLayerOptions`**, **`StackOptions`**, **`StackDefaults`**, **`LayerClientOptions`**, **`LayerGroupOptions`**, **`LayerGroupHandle`**, **`OmitKeyof`**.

Notable per-layer options: `enteringDelay` / `exitingDelay`, `upsert`, `loadFn`, `validate`, `rootProps`, `component`.

Notable per-stack options: `scope: { strategy: "serial" | "parallel" }`, `gcTime`, `dismissAllMode`.

### Snapshots & lifecycle (types)

**`LayerState`**, **`LayerPhase`** (`pending` \| `queued` \| `active` \| `dismissed` \| `error`), **`LayerTransition`** (`entering` \| `settled` \| `exiting`), **`LayerActionStatus`**, **`LayerCallContext`**, **`LayerComponentProps`**, **`LayerComponent`**, **`LayerKey`**.

Transitions complete on **whichever fires first** of `{ enteringDelay/exitingDelay elapsed, call.settle() }`. Serial stacks queue later opens (`phase: "queued"`, visible via `getQueuedSnapshot()`).

### Blockers & bulk dismiss (types)

**`BlockerFn`**, **`StackBlockerFn`**, **`DismissOptions`** (`force?`), **`DismissAllOptions`** / **`DismissAllMode`** (`"skipBlocked"` \| `"stopAtBlocked"` \| `"force"`). `call.end` / `call.dismiss` return `Promise<boolean>` (`false` when vetoed). `dismissing` is `true` while blockers run.

### Standard Schema (type)

**`StandardSchemaV1`** — vendored [Standard Schema v1](https://standardschema.dev) interface (+ `InferInput` / `InferOutput` namespace helpers).

---

Full guide & adapter examples: [repo README](https://github.com/stainless-code/layers#readme). Architecture: [docs/architecture.md](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).
