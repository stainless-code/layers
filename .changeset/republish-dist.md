---
"@stainless-code/layers": patch
"@stainless-code/layers-devtools": patch
"@stainless-code/react-layers-devtools": patch
"@stainless-code/react-layers": patch
"@stainless-code/vue-layers": patch
"@stainless-code/solid-layers": patch
"@stainless-code/svelte-layers": patch
"@stainless-code/preact-layers": patch
"@stainless-code/alpine-layers": patch
"@stainless-code/lit-layers": patch
"@stainless-code/angular-layers": patch
---

Republish with built `dist/` artifacts. `0.2.0`/`0.2.1` tarballs were packed without a prior build (exports pointed at missing `./dist/*`). Release now builds and asserts dist files before pack.
