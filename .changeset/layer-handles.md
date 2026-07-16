---
"@stainless-code/layers": minor
"@stainless-code/react-layers": minor
"@stainless-code/preact-layers": minor
"@stainless-code/vue-layers": minor
"@stainless-code/solid-layers": minor
"@stainless-code/svelte-layers": minor
"@stainless-code/angular-layers": minor
---

Wired layer handles (`createLayer` / `useLayer`) and observe-hook reshape (0.x breaking).

**Migration**

- `useLayer(key, stack?)` → `useLayerState({ key, stack })` (returns `LayerState[]`, not `LayerState | null`)
- `useStack(stackId, selector?, compare?)` → `useStack({ stack, select, compare }, client?)`
- Prefer `useLayer(options).open(payload)` over spreading into `client.open` (bag form still supported)
- `LayerStack.find` is now topmost same-key (`findLast`); `cancelQueued` stays first-queued FIFO

Svelte entry names: `createLayer` / `createLayerState` / `createQueuedStack` / `createLayerQueuedState`. Angular: `injectLayer` / `injectLayerState` / `injectQueuedStack` / `injectLayerQueuedState`.
