# @stainless-code/layers

Headless manager for modal/dialog/drawer/popover/toast UI — **open any layer from anywhere** and manage it as an ordered, named stack. A UI-agnostic core (works with any UI library or framework) + per-adapter packages: declare a layer once, then invoke it imperatively from components, effects, route guards, or plain code. Optionally `await` a typed result. No prop-drilling, no lifted `isOpen`, no callback threading.

> **Status:** experimental — a zero-dep core + React, Preact, Vue, Solid, Angular, and Svelte adapters at ergonomic parity (Angular/Svelte render imperatively/via primitives — see [architecture](docs/architecture.md#adapter-ergonomics)). API may shift.

This is the monorepo — one adapter package per library or framework. Pick yours below.

## Packages

| Library / framework  | Package                                              | Peer            | Install                                  |
| -------------------- | ---------------------------------------------------- | --------------- | ---------------------------------------- |
| _core (UI-agnostic)_ | [`@stainless-code/layers`](packages/core)            | —               | `bun add @stainless-code/layers`         |
| React                | [`@stainless-code/react-layers`](packages/react)     | `react`         | `bun add @stainless-code/react-layers`   |
| Preact               | [`@stainless-code/preact-layers`](packages/preact)   | `preact`        | `bun add @stainless-code/preact-layers`  |
| Svelte               | [`@stainless-code/svelte-layers`](packages/svelte)   | `svelte`        | `bun add @stainless-code/svelte-layers`  |
| Vue                  | [`@stainless-code/vue-layers`](packages/vue)         | `vue`           | `bun add @stainless-code/vue-layers`     |
| Solid                | [`@stainless-code/solid-layers`](packages/solid)     | `solid-js`      | `bun add @stainless-code/solid-layers`   |
| Angular              | [`@stainless-code/angular-layers`](packages/angular) | `@angular/core` | `bun add @stainless-code/angular-layers` |

Install only the adapter for your library or framework — the core (`@stainless-code/layers`) comes along as a dependency and is re-exported, so you import both adapter APIs (`StackProvider`, `useStack`, …) and core APIs (`LayerClient`, `layerOptions`, `LayerState`, …) from the one package. Each adapter lists the library or framework as a **required peer dependency** (the `Peer` column) — you almost always already have it in your app, so nothing extra to install. Svelte ships two entries: `@stainless-code/svelte-layers` (runes, 5.7+) and `@stainless-code/svelte-layers/store` (stores / pre-runes, 3+).

Each package's README has the full per-adapter guide; the [core README](packages/core) covers the UI-agnostic engine.

## When to use it

Overlay UI is cross-cutting, but component models push its state to be local — so you end up prop-drilling `isOpen`, lifting state, threading `onConfirm`/`onCancel`, duplicating modal boilerplate, and hand-rolling z-order and one-at-a-time logic. `layers` moves overlay state into a headless client you invoke imperatively: declare a layer once, open it from anywhere.

Awaiting a result is **optional** — `void client.open({ ...toast, payload })` is a complete fire-and-forget call; the typed response is a bonus axis, not a requirement.

| Use case                                                                                                                                      | What it involves                                         | Fit                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------- |
| Confirm/prompt that returns a value                                                                                                           | `await open` + `DataTag` response inference              | Ideal                             |
| Open an overlay from non-UI code (route guard, event bus, effect, util)                                                                       | global `LayerClient.open`                                | Ideal (incl. fire-and-forget)     |
| Toast / snackbar / progress — one instance, updated live                                                                                      | `upsert` + `update`                                      | Ideal                             |
| One-at-a-time / sequential flows (onboarding, queued confirms)                                                                                | serial `scope` + `getQueuedSnapshot`                     | Ideal                             |
| Stacked or nested overlays (drawer → sub-dialog)                                                                                              | layer groups (`useLayerGroup` / `createLayerGroup`)      | Ideal                             |
| Enter/exit animated overlays                                                                                                                  | `transition` + `enteringDelay`/`exitingDelay` `settle()` | Ideal                             |
| Guard dismissal ("discard unsaved changes?")                                                                                                  | blockers (`addBlocker`, `dismissing`, `dismissAll`)      | Ideal                             |
| Validate an untrusted payload at open                                                                                                         | `validate` (Standard Schema or a function)               | Nice-to-have                      |
| One overlay system across React/Vue/Svelte/Solid/Preact/Angular                                                                               | UI-agnostic core + adapters                              | Ideal                             |
| A single, always-local overlay opened from one component — no return, stacking, queue, animation, or guard, and no wish for a global registry | —                                                        | Skip → plain controlled component |
| Static/inline content with no overlay semantics; full-page navigation                                                                         | —                                                        | Skip → plain markup / a router    |

## Taste (React)

```tsx
import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
  type LayerComponentProps,
} from "@stainless-code/react-layers";

// 1. Declare a layer. Name the contract once — payload in, response out.
type ConfirmPayload = { title: string };
type ConfirmResponse = boolean;

function ConfirmDialog({
  call,
  payload,
}: LayerComponentProps<ConfirmPayload, ConfirmResponse>) {
  return (
    <div role="dialog">
      <h2>{payload.title}</h2>
      <button onClick={() => void call.end(true)}>Yes</button>
      <button onClick={() => void call.end(false)}>No</button>
    </div>
  );
}

const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

// 2. Mount an outlet.
function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

// 3. Call & await — the response type is inferred.
function useRemove() {
  const client = useLayerClient();
  return async () => {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
    if (ok) {
      /* … */
    }
  };
}
```

**Both payload and response are optional.** The response type `R` defaults to `void` (fire-and-forget), and `payload` is omittable whenever the layer needs no input — when `P` is `void`/`unknown`, or you type it `… | undefined`:

```tsx
// No response type, no payload — declare it, then just open it.
const about = layerOptions({
  stack: "modal",
  key: ["about"],
  component: About,
});

client.open(about); // fire-and-forget; the layer dismisses itself via call.dismiss()
```

## Concepts

- Headless `LayerClient` → named `LayerStack`s → `Layer`s; each adapter subscribes via `useSyncExternalStore` (or the library or framework equivalent) + a selector.
- `layerOptions<P, R>()` / `layerKey<R>()` carry the response type end-to-end (via `DataTag`) so `await client.open(...)` infers it — no explicit generic.
- Optional `validate` (a [Standard Schema](https://standardschema.dev) or a sync `(input) => output` fn) parses untrusted `payload` at `open`; failure rejects with `PayloadValidationError` (narrow via `isPayloadValidationError`).
- App-wide error type via `Register` module augmentation (`DefaultLayerError`, `Error` by default).
- Ergonomic wrappers on every adapter — `useLayerGroup`, `useMutationFlow`, `createStackHook` (Angular/Svelte render differently; see [adapter ergonomics](docs/architecture.md#adapter-ergonomics)).
- Named stacks; `upsert` for singletons; `update` for live payload patches; `scope: { strategy: 'serial' }` queues (`getQueuedSnapshot`).
- `transition` axis (`entering` | `settled` | `exiting`) + `enteringDelay`/`exitingDelay` timers and `call.settle()` for enter/exit animations.
- Blockers (`call.addBlocker` / `stack.addBlocker`) gate user-intent dismissal; `dismissing` flag; `dismissAll` modes; `{ force: true }` bypass.
- Batched notifications (`notifyManager`) coalesce rapid push/pop into one render.

See [`docs/architecture.md`](docs/architecture.md) for the full model.

## Develop

This is a [bun workspaces](https://bun.sh/docs/install/workspaces) monorepo; root scripts fan out across packages with `bun run --filter '*' <script>`.

```bash
bun install
bun run check          # build (core-first) + format + lint + test + test:dom + typecheck
bun run test           # bun:test unit suites (packages/*/src)
bun run test:dom       # vitest + jsdom — per-adapter DOM suites (packages/*/tests-dom)
bun run typecheck
bun run size
bun run check:deps     # sherif — workspace dependency lint
```

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) to contribute.
