# @stainless-code/angular-layers

## 0.2.1

### Patch Changes

- Updated dependencies [[`a595180`](https://github.com/stainless-code/layers/commit/a5951806a6a4dbd3cc79a93f08af967721055498)]:
  - @stainless-code/layers@0.2.1

## 0.2.0

### Minor Changes

- [#4](https://github.com/stainless-code/layers/pull/4) [`0cd5770`](https://github.com/stainless-code/layers/commit/0cd577025b6f3709c176f0b764d20310435087a6) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Wired layer handles (`createLayer` / `useLayer`) and observe-hook reshape (0.x breaking).

  **Migration**

  - `useLayer(key, stack?)` → `useLayerState({ key, stack })` (returns `LayerState[]`, not `LayerState | null`)
  - `useStack(stackId, selector?, compare?)` → `useStack({ stack, select, compare }, client?)`
  - Prefer `useLayer(options).open(payload)` over spreading into `client.open` (bag form still supported)
  - `LayerStack.find` is now topmost same-key (`findLast`); `cancelQueued` stays first-queued FIFO

  Svelte entry names: `createLayer` / `createLayerState` / `createQueuedStack` / `createLayerQueuedState`. Angular: `injectLayer` / `injectLayerState` / `injectQueuedStack` / `injectLayerQueuedState`.

### Patch Changes

- Updated dependencies [[`0cd5770`](https://github.com/stainless-code/layers/commit/0cd577025b6f3709c176f0b764d20310435087a6), [`0cd5770`](https://github.com/stainless-code/layers/commit/0cd577025b6f3709c176f0b764d20310435087a6)]:
  - @stainless-code/layers@0.2.0
