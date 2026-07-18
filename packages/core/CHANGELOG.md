# @stainless-code/layers

## 0.2.2

### Patch Changes

- [#21](https://github.com/stainless-code/layers/pull/21) [`dc1d138`](https://github.com/stainless-code/layers/commit/dc1d138031784ea875304226b73c6824d2dc3eeb) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Republish with built `dist/` — prior 0.2.x tarballs omitted it (pack ran without build).

## 0.2.1

### Patch Changes

- [#13](https://github.com/stainless-code/layers/pull/13) [`a595180`](https://github.com/stainless-code/layers/commit/a5951806a6a4dbd3cc79a93f08af967721055498) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add TanStack Devtools inspector: `subscribeNotify` / `StackNotifyEvent` in core (additive, including `dismissVetoed` on soft-dismiss blocker veto), Solid panel in `@stainless-code/layers-devtools`, React doorbell in `@stainless-code/react-layers-devtools`. First publish of the two Devtools packages; versions align with the monorepo at 0.2.1.

## 0.2.0

### Minor Changes

- [#4](https://github.com/stainless-code/layers/pull/4) [`0cd5770`](https://github.com/stainless-code/layers/commit/0cd577025b6f3709c176f0b764d20310435087a6) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - `cancelQueued` optional `{ id }` now cancels the exact queued instance; omit `id` for first-queued (FIFO) per key.

- [#4](https://github.com/stainless-code/layers/pull/4) [`0cd5770`](https://github.com/stainless-code/layers/commit/0cd577025b6f3709c176f0b764d20310435087a6) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Wired layer handles (`createLayer` / `useLayer`) and observe-hook reshape (0.x breaking).

  **Migration**

  - `useLayer(key, stack?)` → `useLayerState({ key, stack })` (returns `LayerState[]`, not `LayerState | null`)
  - `useStack(stackId, selector?, compare?)` → `useStack({ stack, select, compare }, client?)`
  - Prefer `useLayer(options).open(payload)` over spreading into `client.open` (bag form still supported)
  - `LayerStack.find` is now topmost same-key (`findLast`); `cancelQueued` stays first-queued FIFO

  Svelte entry names: `createLayer` / `createLayerState` / `createQueuedStack` / `createLayerQueuedState`. Angular: `injectLayer` / `injectLayerState` / `injectQueuedStack` / `injectLayerQueuedState`.
