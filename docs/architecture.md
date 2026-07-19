# Architecture

`@stainless-code/layers` is a headless layer/stack manager: modals, dialogs, drawers, popovers, toasts, etc. are **layers in named stacks**. A UI-agnostic core (works with any UI library or framework) owns the engine; thin per-adapter packages render the active stack in each library or framework's reactivity.

The design is self-contained: an app-wide client owns named, ordered stacks of layers; each adapter subscribes to a stack's snapshot and renders the active layers in that library or framework's reactivity; a caller opens a layer from anywhere and may `await` its typed result.

For when to reach for this library (and when a plain component is simpler), see [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use).

## Package boundary

The seam is a **published package boundary** in a bun-workspaces monorepo: one zero-dep core package plus one adapter package per library or framework. Each adapter takes the core as a **direct dependency** and re-exports it, so a consumer installs only the package for their library or framework (`npm i @stainless-code/react-layers`) and core comes along transitively.

```
@stainless-code/layers              core package (packages/core, zero-dep)
  LayerClient ──┬── LayerStack (named, ordered) ── Layer[]
                └── LayerClientOptions.defaultStackOptions
@stainless-code/<fw>-layers         adapter package (packages/<fw>)
  dependencies:      @stainless-code/layers (workspace:* → resolved on publish)
  peerDependencies:  the library or framework (required)
  binds LayerStack.subscribe/getSnapshot → UI reactivity
  renders layers (StackOutlet, renderStack, or useStack().current — see § Adapter ergonomics)
```

- **Core** (`packages/core` → `@stainless-code/layers`): `LayerClient` (`ensureStack`, `getStackIds`, `subscribeStacks`), `LayerStack` (`dismiss`/`dismissAll`/`cancelAll`/`addBlocker`/`settle`/`setRunning`/`cancelQueued`/`getQueuedSnapshot`), `Layer`, `Subscribable`, `notifyManager`, `ControlledPromise`, `createCallContext`, `layerOptions`, `layerKey`/`DataTag`, `createLayer`/`LayerHandle`/`ValidatedLayerHandle`, `createLayerGroup`/`childStackId`, `layerGcCache` (internal), `errors`, payload validation (`StandardSchemaV1`, `Validator`, `PayloadValidationError`, `isPayloadValidationError`), `Register`/`DefaultLayerError`, `utils`. Zero deps; `sideEffects: false`. Entry `.` → `src/index.ts`.
- **Adapters** (`packages/<fw>` → `@stainless-code/<fw>-layers`): each declares the library or framework as a **required peer dependency** and `@stainless-code/layers` as a direct dependency, re-exports core (including `createLayer`), and exposes the wired/observe hooks (`useLayer` / `useLayerState` / `useQueuedStack` / `useLayerQueuedState` — names vary per § Adapter ergonomics), a `useStack`-shaped binding, an idiomatic client-context provider + `useLayerClient` (React/Preact `StackProvider`; Svelte `setLayerClient`; Vue/Lit `provideLayerClient`; Solid `LayerClientContext`; Angular `LAYER_CLIENT` + `provideLayerClient`; Alpine `getLayerClient` / `setLayerClient` in plugin closure), and a rendering surface (`StackOutlet`, or the imperative/primitive equivalent — see § Adapter ergonomics). Lit peers are `lit` + `@lit/context`; CEs register via explicit `defineStackElements()` (not on import). Alpine peers `alpinejs` (required) plus optional peer `@alpinejs/focus` (`peerDependenciesMeta.optional`); `./cdn` bootstrap mirrors ESM. **Svelte ships two entries in one package:** `.` (runes, `svelte/reactivity`, 5.7+) and `./store` (stores, `svelte/store`, 3.0+). All adapters have reached ergonomic parity; Angular, Alpine, and Svelte diverge by design (compiler-free / markup-in-template → primitive rendering rather than shipped host components or a `component` registry); Lit diverges with shadow provider + light-DOM outlet CEs + `LayerGroup.outlet()` (footnote ⁷).

Cross-package type resolution in dev uses a `@stainless-code/source` export condition (each package's `exports` maps it to `src`) plus tsconfig `customConditions`, so typecheck resolves core's source without a build-order dependency; published consumers get `dist` via the standard `types`/`import` conditions.

The isolation invariant: each adapter package imports **only** `@stainless-code/layers` + its library or framework peer. The package boundary enforces it structurally (an undeclared import fails install/build); `sherif` (workspace dependency lint) + per-package `knip` catch drift, and core keeps a zero-dependency guard. No cross-adapter coupling.

Optional Devtools packages (`layers-devtools`, `react-layers-devtools`) sit outside this seam — TanStack UI, not zero-dep core and not framework adapters. Core owns `StackNotifyEvent` + `subscribeNotify` / `seedNotify` (no `@tanstack/*`); `EventClient` lives only in `layers-devtools`. Notify emits when `#flush` changes snapshot/queued refs (plus `register`) — not on every labeled `#dispatch`. Rejected for v1: `EventClient` in core; bus-bidirectional panel commands (live `LayerClient` actions instead).

## Adapter ergonomics

Every adapter exposes the same primitives (client context, `useLayerClient`, wired + observe hooks, `useStack`/`useQueuedStack` options-bag subscriptions) and re-exports the full core, so anything one adapter can do is reachable in another through those. On top of the primitives each adapter ships ergonomic wrappers — sugar over the primitives, not extra engine capability. All adapters have reached parity; **Angular, Alpine, and Svelte diverge by design** because they build compiler-free (tsdown, no framework compiler), so they render through markup-in-template / primitive APIs instead of shipped host components or a `component` registry.

**Drive vs observe:** `useLayer` / `createLayer` drive; `useLayerState` / `useLayerQueuedState` / `useStack` / `useQueuedStack` observe only. Stack-level ops route via `handle.stack.*` (not re-delegated onto the handle). Terms: [glossary](./glossary.md).

**Array observe + topmost find:** observe hooks return `LayerState[]` (all same-key). `LayerStack.find` is **topmost** (`findLast`); `cancelQueued` without `{ id }` is first-queued (FIFO), with `{ id }` the exact queued instance — different collections, different defaults.

| Capability                                             | React | Preact | Vue | Solid | Angular | Lit | Alpine | Svelte (runes) | Svelte (store) |
| ------------------------------------------------------ | :---: | :----: | :-: | :---: | :-----: | :-: | :----: | :------------: | :------------: |
| Primitives + core re-export                            |  ✅   |   ✅   | ✅  |  ✅   |   ✅    | ✅  |   ✅   |       ✅       |       ✅       |
| `StackOutlet` (built-in host)                          |  ✅   |   ✅   | ✅  |  ✅   |   ✅¹   | ✅  |  ✅⁸   |       —⁴       |       —⁴       |
| `StackSubscribe` (render-prop / scoped slot)           |  ✅   |   ✅   | ✅  |  ✅   |   —²    | ✅  |   —⁸   |       —⁴       |       —⁴       |
| `useStackHandles` (headless `{ states, getCall }`)     |  ✅   |   ✅   | ✅  |  ✅   |   ✅    | ✅  |   —⁸   |       —⁵       |       —⁵       |
| `useMutationFlow` (async-action helper)                |  ✅   |   ✅   | ✅  |  ✅   |   ✅    | ✅  |   ✅   |       ✅       |       ✅       |
| `useLayerGroup` (nested-stack hook)                    |  ✅   |   ✅   | ✅  |  ✅   |   ✅³   | ✅  |  ✅⁸   |      ✅⁶       |      ✅⁶       |
| `createStackHook` (`useAppStack`/`AppHost`/`AppLayer`) |  ✅   |   ✅   | ✅  |  ✅   |   ✅³   | ✅  |  ✅⁸   |       —⁴       |       —⁴       |

¹ Angular ships `renderStack(vcr)` — a compiler-free imperative outlet (`ViewContainerRef.createComponent` + `setInput`, id-keyed so state changes update inputs without recreating components). ² Angular has no `StackSubscribe`; its `useStack({ select })` signal is the idiomatic equivalent. ³ Angular's `useLayerGroup`/`createStackHook` expose `renderInto(vcr)` instead of an `Outlet` component; `createStackHook` returns `{ provideClient, useAppStack, renderInto }` (no `AppHost`/`AppLayer`). ⁴ Svelte ships no `.svelte` components: render with `{#each useStack().current as s}` + `callFor(s)` (runes) / `{#each $stack}` + `callFor(client, stackId, s)` (store) in your own markup. ⁵ Svelte's `useStack()` already returns the headless pair — `.current` (states) + `callFor`. ⁶ Svelte's `useLayerGroup` exposes the child `stack` (`SvelteStack` / `Readable`) instead of an `Outlet`. ⁷ Lit's `useLayerGroup` exposes `outlet(): TemplateResult` (router `Routes.outlet()`-shaped) instead of an `Outlet` component; `StackProvider` uses default shadow + `<slot>`; `StackOutlet`/`StackSubscribe`/`app-host` are light-DOM CEs. Register via explicit `defineStackElements()` (not on import; `"sideEffects": false`). Layer `component` is a `LitElement` constructor or `(props) => TemplateResult` — no tag strings. No `./signals` until Lit first-party signals (Svelte dual-API bar); `@lit/context` `ContextRoot` stays optional for late-upgraded providers (not auto-installed). ⁸ Alpine: `x-layer-outlet` + `$layer` (outlet expression evaluates to a stack id string — quote in markup); Rank-2 `Alpine.data('layerStack')` + `x-for` + `callFor`; no `component` on `layerOptions`; `createStackHook` → `{ setClient, useAppStack }` (no `AppHost`/`AppLayer`); client via `getLayerClient` / `setLayerClient` (not `Alpine.store`); CDN `./cdn` before Alpine core (`alpine:init`).

Per-adapter API detail lives on the [Blume adapters pages](https://stainless-code.com/layers/adapters); this matrix is the cross-adapter comparison for choosing and porting between adapters.

## Layer lifecycle

```
pending ──loadFn──▶ active ──dismiss──▶ dismissed + exiting ──exitingDelay/#remove──▶ removed ──gcTime──▶ cached
   │                   │
   │  loadFn throws    │  dismissAll
   ▼                   ▼
 error              (all active + queued resolved)

serial scope: later opens wait as `queued` (not mounted) — see `getQueuedSnapshot()`
```

- `pending` — `loadFn` in flight (cancelable via `AbortController`).
- `queued` — serial scope only: waiting behind the occupying layer; not in `getSnapshot()`; visible via `getQueuedSnapshot()`.
- `active` — mounted; component receives `call` (`end`/`dismiss`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`/`addBlocker`), `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, `dismissing`.
- `dismissed` — caller's `await` resolved (`ended=true`); `transition: "exiting"` keeps the layer mounted for `exitingDelay` (or until `settle`); on removal, cached for `gcTime` so re-opening the same key restores `data` without re-running `loadFn`.
- `error` — `loadFn` threw; the caller's `await` rejects.

Three independent axes: `phase` (resolution), `transition` (animation — see § Transitions), and `actionStatus` (`idle` | `running`) for in-layer mutations.

## Transitions

Animation is a **third axis** orthogonal to `phase`, mirroring the `actionStatus` precedent:

```ts
phase: "pending" | "queued" | "active" | "dismissed" | "error"; // resolution
transition: "entering" | "settled" | "exiting"; // animation
actionStatus: "idle" | "running"; // in-flight action
```

`"exiting"` is **not** a `phase` member; enter/exit animation lives on `transition`. `phase: "dismissed"` means the promise resolved; `transition` disambiguates exit anim vs cached:

| moment                       | `phase`     | `transition` |
| ---------------------------- | ----------- | ------------ |
| opening, loading             | `pending`   | `entering`   |
| opening, no load             | `active`    | `entering`   |
| open & idle                  | `active`    | `settled`    |
| dismissed, animating out     | `dismissed` | `exiting`    |
| dismissed, cached (`gcTime`) | `dismissed` | `settled`    |
| load threw                   | `error`     | `settled`    |

Completion = **whichever fires first** of `{ delay elapsed, call.settle() }`:

- `enteringDelay` — ms before `entering → settled` (default `0` = instant).
- `exitingDelay` — ms before removal after dismiss (default `0` = instant).
- `call.settle()` — imperative early finish: `entering → settled` (clears enter timer; `phase` untouched); `exiting → remove` (clears exit timer); no-op if already `settled`.

Delay `0` (default) flips the axis synchronously — no transition frame observed, backward compatible. Fixed CSS transitions: set `enteringDelay`/`exitingDelay`, skip `settle()`. Springs/variable duration: generous cap delay + `onTransitionEnd`/`onRest → call.settle()`.

Layers are client-only today (React/Preact `getServerSnapshot` returns `[]`); when SSR hydration lands, initial `transition` must be `"settled"`.

**Identity:** each layer has a unique **instance id** (`LayerState.id`, `` `${hashKey(key)}#n` ``) for rendering keys and instance lookup/removal. The **key** is the logical identity (`find`/`upsert`/`gcTime` use `keySignature(key)`); keys must be JSON-safe or `hashKey` throws `LayerKeyError`. Multiple live layers may share a key in a `parallel` stack.

## Blockers

Consumer predicates gate **user-intent** dismissal — `end`/`dismiss`, backdrop/Esc, programmatic `dismiss`/`dismissAll` — while never stranding teardown. Invariant: **a blocker can delay a user closing a layer, never prevent the system from tearing it down.**

**Registration** — two scopes, one gate (`any` veto → blocked); each returns a disposer; multiple per scope (`Set`):

```ts
call.addBlocker(fn: () => boolean | Promise<boolean>): () => void;           // instance
stack.addBlocker(fn: (layer: LayerState) => boolean | Promise<boolean>): () => void; // stack policy
```

`true` = allow; falsy = veto. Instance scope matches the instance-id model (dirty state lives on `call`). Stack scope covers app policy (selective by `layer`).

**Async + reject** — predicates may be async; `dismiss` awaits them. A veto **rejects** the attempt (layer stays open; caller re-issues after confirming) rather than deferring the caller's `Promise<R>`. Confirm UI is the consumer's own layer — core never opens UI.

```ts
call.end(response, opts?: { force?: boolean }): Promise<boolean>;   // was void
call.dismiss(response, opts?: { force?: boolean }): Promise<boolean>;
```

Return value = "did it dismiss?". `{ force: true }` bypasses blockers. Repeat `end`/`dismiss` while `dismissing` dedupes to the in-flight promise; `force` wins immediately. Predicate throw/reject = veto (fail-closed; dev warning).

**Paths** — honor blockers: `end`/`dismiss` (user intent). Skip: `cancelQueued` (serial, never mounted), `cancelAll` (system teardown). **Layer-group cascade** (`onLayerDismiss` → `#drainChildStacks` → `cancelAll`) rejects child `open()` with `LayerCancelledError` — guard the parent instead.

**`dismissAll` modes** — `stack.dismissAll(response, opts?: { mode? })` is async:

| mode                      | behavior                                          |
| ------------------------- | ------------------------------------------------- |
| `"skipBlocked"` (default) | attempt each; close permitted, leave blocked open |
| `"stopAtBlocked"`         | process in order; halt at first blocked           |
| `"force"`                 | bypass all blockers                               |

Default configurable via `StackOptions.dismissAllMode` / `LayerClientOptions.defaultStackOptions`. Precedence: per-call `mode` > stack default > `"skipBlocked"`.

**`dismissing`** — `LayerState.dismissing` (`true` while blockers are evaluated for a user-intent dismiss); back to `false` on veto or removal. Generic UI can disable the close button during async confirm. Veto is transient (via `Promise<boolean>`), not a persisted flag.

Gate runs **before** exit transition (§ Transitions): allowed → resolve promise, `phase: "dismissed"`, `transition: "exiting"`; vetoed → layer stays `active`.

## Error handling

`open` returns `Promise<R>` (the await-the-response contract) — so error types are **not** carried on the promise (TypeScript can't type promise rejections). The promise **rejects** with:

- the `loadFn`-thrown error (typed `E` at runtime), or
- a `PayloadValidationError` when `validate` fails (see below).

Narrow in a `catch` with the shipped guards (`isPayloadValidationError`) or the app's own error guards. A typed-error-on-await would require a `Result`-returning `open`, which we deliberately reject to keep the direct-`await` ergonomic; an opt-in `openSafe()` may come later.

**Payload validation** — an optional `validate` (a [Standard Schema](https://standardschema.dev) or a sync `(input) => output` fn) on `open`/`layerOptions` parses untrusted input **synchronously at `open`, before mount**. It parses/transforms: `open`'s `payload` argument is the schema **input**, while the layer stores (and the component sees) the **output**. Invalid input rejects `open` with `PayloadValidationError` and mounts nothing; an async schema is a config error. No schema-library dependency — Standard Schema is the universal interface.

## Stacks, scope, gcTime

- **Named stacks** — `LayerClient.getStack(id)`; isolated. `open({ stack })` picks one.
- **`scope: { strategy: 'serial', onLoadError?: 'block' | 'advance' }`** — one occupying layer at a time (`pending` / `active` / `error` under default `onLoadError: 'block'`); later opens queue (`phase: 'queued'`, visible via `getQueuedSnapshot()`) and activate when the occupant leaves. `onLoadError: 'advance'` removes a failed `loadFn` layer and drains the next queued open. `parallel` (default) stacks freely. `dismissAll` (async; see § Blockers) drains the queue, resolving queued callers without mounting.
- **`gcTime`** — dismissed layers cached (in the internal `layerGcCache` module — a small removable-cache primitive) so re-opening the same key skips `loadFn`. **One slot per key signature — last-dismissed-wins**; the displaced entry is evicted with explicit teardown, and re-open cancels the timer. A cached layer is off-`getSnapshot()` and inherently unobserved, so the timer-runs-while-cached model already matches observer-gated gc. _Rejected: pausing gc while the stack is unmounted (would serve unbounded-stale data — no `staleTime`/refetch model — and risk retention), and a per-layer observer refcount (a stack-level proxy for it); revisit only alongside a real freshness model._

## Notifications

`Subscribable` wraps each listener in `notifyManager.batchCalls` at subscribe time; `open`/`dismiss`/`update` run inside `notifyManager.batch`, so multiple mutations in one tick collapse to one UI re-render. The flush is **synchronous** (predictable, UI-agnostic, no per-adapter scheduler). To coalesce several independent calls in one tick into a single notification across every adapter, wrap them yourself: `notifyManager.batch(() => { client.open(a); client.open(b); })`.

## React binding

`useStack({ stack?, select?, compare? }, client?)` → `useSyncExternalStore(stack.subscribe, getSnapshot, getServerSnapshot)`. Same options-bag shape for `useQueuedStack`, `useLayerState`, `useLayerQueuedState`. The snapshot is cached on `LayerStack` (stable ref between mutations); the hook memoizes selector output against that base snapshot with `compare`-equality (default `Object.is`) so object/array selectors don't churn. `StackOutlet` maps the snapshot to components, building `call` via `createCallContext`. SSR-safe `getServerSnapshot` returns `[]`.

## SSR posture

- **React / Preact** — `useSyncExternalStore` calls `getServerSnapshot` and **never invokes `subscribe` on the server**, so the store is read once with no listener registered. This is the whole SSR-safety story for these adapters.
- **Svelte** — `createSubscriber` is lazy: it only starts the subscription when `.current` is read inside a reactive (effect) context, which doesn't happen during server string rendering — so no eager server subscription.
- **Vue / Solid / Angular** — subscribe eagerly but register teardown (`onScopeDispose` / `from` owner / `effect` `onCleanup`) that runs when the library or framework disposes the SSR render scope, so no cross-request listener leak.
- **Lit** — Reactive Controllers subscribe in `hostConnected` and tear down in `hostDisconnected`; `hostConnected` does not fire during SSR string rendering, so no listener is registered server-side.
- A **proactive "skip subscribe on the server"** guard for Vue/Solid/Angular was **deliberately not added**: there is no clean, test-safe server detector (bun's test env has no `window` and resolves Solid to its SSR build, so a `typeof window`/`isServer` guard would skip subscription in the adapters' own unit tests and break their reactivity assertions), and the teardown above already prevents leaks. Revisit only if a concrete SSR leak surfaces.

## Headless rendering

`useStackHandles(stack?, rootProps?) → { states, getCall }` is the headless primitive for rendering a stack's layers yourself (custom per-layer components, portals, switches). Angular and Svelte expose equivalent rendering paths by design — see § Adapter ergonomics. Where shipped, `StackOutlet` is the registered-component convenience built on `useStackHandles`, dev-warning when a layer has no `component`. `StackSubscribe` is a render-prop subscription with selector isolation. `StackOutlet` deliberately has **no** `render` prop — use `useStackHandles` or `StackSubscribe`.

## Layer groups

A parent layer owns a **child stack** on the same `LayerClient` via `createLayerGroup(client, call)` (each adapter wraps it as `useLayerGroup(call)`). The child stack id is derived collision-safely from the parent's `stackId` + instance `layerId` — `` `${parentStackId}~${parentLayerId}~${name}` `` — so sibling and nested groups never clash. Lifetime is **event-driven**: `LayerStack.onLayerDismiss` fires on dismiss → the client `cancelAll`s that layer's registered child stacks (`reason: "parentDismiss"`), recursively for nesting. No second client, no manual cleanup. Rejected alternatives: a second `LayerClient` (disconnected from provider/config) and a `call.group()` method (would couple the call-context module to the client).

## Type defaults & inference

- `layerOptions` brands its `key` with a `DataTag`, so `LayerClient.open` infers the response type with no explicit generic; `open` also has a validated overload (see § Error handling) where `payload` is the schema **input**.
- `Register` (module augmentation) sets `DefaultLayerError` app-wide (`Error` unless augmented). There is **no** global key→response registry — colocated `layerOptions`/`layerKey` is the single source of truth.
- Each `open` creates a `Layer` with a unique **instance id** (`` `${hashKey(key)}#n` ``); the `key` is the _logical_ identity used by `find`/`upsert`/`gcTime`, so a `parallel` stack may hold multiple same-key layers without collisions.
- `open` returns `Promise<R>` (the await-the-response contract) — rejections are not typed (a TS limitation; a `Result` wrapper was rejected to preserve direct `await`); narrow errors via branded guards like `isPayloadValidationError`.

## Test matrix

Each package owns its tests (`bun run --filter '*' test` fans out).

| Suite                             | Runner                                   | Scope                                                                                               |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/*/src/**/*.test.ts`     | `bun:test`                               | core engine (`packages/core`) + each adapter binding (library or framework module mocked or scoped) |
| `packages/*/tests-dom/**`         | `vitest` + jsdom + per-adapter harness   | real-renderer DOM suites per adapter — rendering, mutation-flow, layer-group, no-remount invariant  |
| `packages/*/**/*.test-d.{ts,tsx}` | `tsc --noEmit` (per-package `typecheck`) | type-level inference — core plus every adapter                                                      |

Adapter binding tests mock the library or framework module (`solid-js` → client build; `@angular/core` stub; `preact/compat` stub) or use a real reactive scope (`vue` `effectScope`), and assert the value contract. The reactive auto-update path that needs a full renderer is pinned per adapter by the DOM suites; the `LayerStack` subscription it rides on is pinned in core tests. Package-level import isolation (each adapter only depends on core + its library or framework peer) is enforced by the package boundary + `sherif`/`knip` rather than a per-file test.

**DOM-harness convention:** each DOM-tested package owns a `vitest.config.ts` + its framework's testing library + `jsdom`/`vitest` devDeps (React/Preact/Vue `@testing-library/<fw>`; Solid `vite-plugin-solid` + `@solidjs/testing-library`; Angular `@analogjs/vite-plugin-angular` + TestBed with a self-contained `tsconfig.spec.json`; Lit vitest + jsdom with real custom elements; Alpine vitest + jsdom with real `alpinejs`; Svelte `@sveltejs/vite-plugin-svelte` + `@testing-library/svelte`), a `test:dom` script, and its `tests-dom/**` registered as a `knip` entry. Test deps are version-pinned to match React's so `sherif` stays green. DOM tests resolve the package by name → its built `dist`, so **build before `test:dom`** (the root `check` builds first).
