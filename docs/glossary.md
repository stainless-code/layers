# Glossary

Ubiquitous language for the `@stainless-code/layers` domain. Keep terms stable across code, docs, and issues.

- **Layer** — one frame in a stack; a modal, dialog, drawer, popover, toast, etc. Owned by a `LayerStack`; carries a `key`, `payload`, optional `data` (from `loadFn`), a `phase`, and a caller-facing `promise`.
- **Stack** (`LayerStack`) — ordered collection of active layers for one surface (`"confirm"`, `"drawer"`, `"toast"`). Identified by `id`; subscribed via `subscribe`/`getSnapshot` (mountable layers) and `getQueuedSnapshot` (serial-waiting layers).
- **Client** (`LayerClient`) — app-wide orchestrator owning named stacks; `open()` returns a typed `Promise<Response>`.
- **Key** — the **logical** identity of a layer (`find`/`upsert`/`gcTime` operate on `keySignature(key)`); multiple live layers may share a key in a `parallel` stack.
- **Instance id** (`LayerState.id`) — the **physical**, unique id of one `Layer` instance (`` `${hashKey(key)}#n` ``); used for rendering keys and instance lookup/removal (`getLayer`, `#remove`).
- **Phase** — resolution lifecycle axis: `pending` → `active` → `dismissed`; or `queued` (serial-waiting, not mounted); or `error`. Does **not** include `exiting` — animation is on `transition`. Distinct from `actionStatus` and `transition`.
- **Transition** — animation axis (`entering` | `settled` | `exiting`), orthogonal to `phase` (like `actionStatus`). `dismissed + exiting` = playing exit anim; `dismissed + settled` = cached/done.
- **Entering** — `transition: "entering"` while a layer mounts/opens; may coincide with `phase: "pending"` (loading) or `phase: "active"`.
- **Settled** — `transition: "settled"` when enter/exit animation is done (or instant, delay `0`).
- **settle** (`call.settle()`) — resolve the current transition early: `entering → settled` (clears enter timer; `phase` untouched); `exiting → remove` (clears exit timer); no-op if already `settled`. Completion is whichever of `{ delay elapsed, call.settle() }` fires first.
- **enteringDelay** — ms the enter transition runs before settling; `0` (default) = instant. `call.settle()` finishes early.
- **exitingDelay** — ms the exit transition runs before removal; `0` (default) = instant. `call.settle()` removes early.
- **Action status** — independent axis (`idle` | `running`) for in-layer mutations, separate from `phase` and `transition`.
- **Call context** (`LayerCallContext`) — imperative handle handed to a layer component: `end`/`dismiss` (async — resolve the caller's `await`; return `Promise<boolean>`), `addBlocker`, `update` (patch payload live), `setRunning` (drives `actionStatus`), `settle` (drives `transition`), `ended`, `index`, `stackSize`, `root`, `stackId`, `layerId`. Built by `createCallContext`.
- **open** — push a layer onto a stack; returns `Promise<R>` resolved by `dismiss`. The caller `await`s the user's decision.
- **dismiss** — async (`Promise<boolean>`): consult blockers (unless `{ force: true }`), then resolve the layer's promise with a response, flip `ended`, set `phase: "dismissed"` + `transition: "exiting"`, then remove after `exitingDelay` or `call.settle()` (whichever first). Return `true` if dismissed, `false` if vetoed.
- **blocker** — consumer predicate gating user-intent dismissal; `true` = allow, falsy = veto. Instance (`call.addBlocker`) or stack (`stack.addBlocker`) scope; multiple allowed; async-capable; throw/reject = veto (fail-closed).
- **addBlocker** — register a blocker; returns a disposer. `call.addBlocker(fn)` — instance scope (`() => boolean | Promise<boolean>`). `stack.addBlocker(fn)` — stack policy (`(layer) => boolean | Promise<boolean>`).
- **dismissing** — `LayerState.dismissing`: `true` while a user-intent dismiss is consulting blockers; `false` on veto or removal. Use to disable close UI during async confirm.
- **dismiss mode** — `DismissAllMode` for `stack.dismissAll`: `"skipBlocked"` (default — close permitted, leave blocked open), `"stopAtBlocked"` (halt at first blocked), `"force"` (bypass blockers). Default per stack via `StackOptions.dismissAllMode`.
- **upsert** — reusing an active key updates its payload instead of stacking (singleton toasts/progress).
- **scope** — per-stack queueing on `StackOptions`: `scope: { strategy: "serial" | "parallel" }` (`parallel` when omitted); `serial` = one active layer at a time, `parallel` = stack freely.
- **gcTime** — keep dismissed layers in a cache so re-opening the same key restores `data` without re-running `loadFn`. One slot per key (last-dismissed-wins); evicted after `gcTime` with explicit teardown.
- **loadFn** — optional async load run on `open`; cancelable via `AbortController`; `pending` → `active` with `data` on success, `error` on throw.
- **Observer / selector** — adapters subscribe to `LayerStack.getSnapshot()` and project via a selector (React `useSyncExternalStore`, Solid `from`, Angular `signal`, Vue `shallowRef`, Svelte runes).
- **Options helper** (`layerOptions`) — identity function carrying `<P, R, E, D>` generics so `LayerClient.open` infers the response type end-to-end.
- **Outlet** — renders the active stack. React, Preact, Solid, and Vue ship `StackOutlet`; Angular exposes `renderStack(vcr)`; Svelte renders from `useStack().current` + `callFor`. See [adapter ergonomics](./architecture.md#adapter-ergonomics).
- **Stack handles** (`useStackHandles`) — headless `{ states, getCall }` for custom hosts (React/Preact/Solid/Angular/Vue; Svelte's `useStack()` already returns `.current` + `callFor`). `StackOutlet` is the registered-component convenience built on it where shipped.
- **Layer group** — a child stack owned by a parent layer and tied to its lifetime: created via `createLayerGroup` / adapter `useLayerGroup`; when the parent dismisses, the group's stack auto-drains. Same `LayerClient`, no second client.
- **Child stack** — the stack a layer group opens onto; id derived from the parent's `stackId` + `layerId` via `childStackId` (`` `${parentStackId}~${parentLayerId}~${name}` ``).
- **Validator** (`validate`) — a Standard Schema or sync `(input) => output` fn that parses/validates a layer's `payload` at `open`; the layer stores the parsed output. Failure rejects `open` with a `PayloadValidationError`.
