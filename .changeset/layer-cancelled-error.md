---
"@stainless-code/layers": patch
"@stainless-code/react-layers": patch
"@stainless-code/preact-layers": patch
"@stainless-code/vue-layers": patch
"@stainless-code/solid-layers": patch
"@stainless-code/angular-layers": patch
"@stainless-code/svelte-layers": patch
"@stainless-code/alpine-layers": patch
"@stainless-code/lit-layers": patch
"@stainless-code/layers-devtools": patch
---

Add `cancelAll` and `LayerCancelledError`: system teardown (parent-dismiss child drain, layer-group dispose, host disconnect) now **rejects** `open()` instead of resolving `undefined`. User `dismiss` / `dismissAll(response)` still complete with `R`. Narrow with `isLayerCancelledError`. Devtools: **Dismiss all** still calls `dismissAll` (resolves); **Force clear** calls `cancelAll` (rejects).
