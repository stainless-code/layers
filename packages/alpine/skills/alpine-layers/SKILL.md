---
name: alpine-layers
description: Alpine.js adapter for @stainless-code/alpine-layers; plugin magics, x-layer-outlet, layerStack data, and JS hooks for typed layer stacks
license: MIT
keywords:
  - tanstack-intent
  - alpinejs
  - alpine
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/alpine-layers"
  library_version: "0.2.3"
  framework: "alpinejs"
sources:
  - https://stainless-code.com/layers/adapters/alpine
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Alpine layer/stack UI with @stainless-code/alpine-layers

Open overlay UI imperatively and manage it as an ordered, named stack. The package re-exports `@stainless-code/layers`. For engine internals, use the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md).

## Install

```bash
bun add @stainless-code/alpine-layers
```

Peer: `alpinejs` (>=3.13). Register with `Alpine.plugin(layers)` before `Alpine.start()`, or use the `./cdn` entry on `alpine:init`.

## Binding model

- **Client:** `getLayerClient()` lazy-inits; `setLayerClient()` only required to pin a custom client before first use.
- **Drive:** `$layers.open` (magic) + `createLayer` (wired `state` / `queued` / `top`).
- **Observe:** `useStack`, `createLayerState`, `Alpine.data('layerStack')` + `x-for`.
- **Outlet:** `x-layer-outlet` on `<template>`; row props via `$layer` (`call`, `payload`, …).

## Learn more

- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Adapter hooks reference](https://stainless-code.com/layers/reference/adapter-hooks)
