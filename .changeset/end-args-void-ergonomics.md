---
"@stainless-code/layers": patch
"@stainless-code/react-layers": patch
"@stainless-code/preact-layers": patch
"@stainless-code/solid-layers": patch
"@stainless-code/vue-layers": patch
"@stainless-code/svelte-layers": patch
"@stainless-code/angular-layers": patch
---

`EndArgs`: omit dismiss/end response when `undefined extends R` (twin of `PayloadArg`). Applies to `call.end`/`dismiss`, stack `dismiss`/`dismissAll`/`cancelQueued`, and handle `dismiss`/`cancelQueued`. **Type tighten:** handle dismiss/cancelQueued are no longer always-optional — bare omit errors when `R` does not admit `undefined`. Adapter skills note void omit.
