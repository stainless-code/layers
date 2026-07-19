# @stainless-code/react-layers

## 0.2.3

### Patch Changes

- [#30](https://github.com/stainless-code/layers/pull/30) [`9d804c2`](https://github.com/stainless-code/layers/commit/9d804c20018d021ab6615b5b064801e6feff3edd) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `cancelAll` and `LayerCancelledError`: system teardown (parent-dismiss child drain, layer-group dispose, host disconnect) now **rejects** `open()` instead of resolving `undefined`. User `dismiss` / `dismissAll(response)` still complete with `R`. Narrow with `isLayerCancelledError`. Devtools: **Dismiss all** still calls `dismissAll` (resolves); **Force clear** calls `cancelAll` (rejects).

- Updated dependencies [[`de3bd7b`](https://github.com/stainless-code/layers/commit/de3bd7bfced94ce91606388c4cfe921782f949bc), [`9d804c2`](https://github.com/stainless-code/layers/commit/9d804c20018d021ab6615b5b064801e6feff3edd), [`323be82`](https://github.com/stainless-code/layers/commit/323be82c2a6a7fc575099021a4441e71fec29943)]:
  - @stainless-code/layers@0.2.3

## 0.2.2

### Patch Changes

- [#21](https://github.com/stainless-code/layers/pull/21) [`dc1d138`](https://github.com/stainless-code/layers/commit/dc1d138031784ea875304226b73c6824d2dc3eeb) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Republish with built `dist/` — prior 0.2.x tarballs omitted it (pack ran without build).

- Updated dependencies [[`dc1d138`](https://github.com/stainless-code/layers/commit/dc1d138031784ea875304226b73c6824d2dc3eeb)]:
  - @stainless-code/layers@0.2.2

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
