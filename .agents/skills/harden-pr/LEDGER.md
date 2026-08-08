# Harden-pr ledger

Single durable backlog for [`harden-pr`](./SKILL.md). Parent reads **§ Rejections** at vet step; **§ Deferred** on cap and on `/harden-pr reconcile`.

## Rejections

By-design or false-positive findings — do not re-raise.

```markdown
- **[category]** `file:line` — label: reason
```

<!-- Example:
- **[correctness]** `packages/core/src/layerStack.ts` — snapshot cached + rebuilt inside `notifyManager.batch`: by-design — `useSyncExternalStore` needs a referentially-stable snapshot between mutations or it infinite-loops.
-->

- **[public-api]** `packages/lit/src/index.ts` `layerClientContext` export — by-design; rationale on the const JSDoc.
- **[public-api]** `packages/lit/src/index.ts` `StackController` `queued`/`deferClient`/`bindClient` — by-design; rationale on the class/ctor JSDoc (factories are the supported path).
- **[correctness]** `packages/alpine/src/index.ts` multi-child `x-layer-outlet` template — by-design; Alpine `<template>` loops (`x-for`/`x-if`) require a single root element; outlet matches that contract (document in alpine.mdx).
- **[docs]** `apps/docs/content/adapters/index.mdx` Alpine footnote `⁷` vs `docs/architecture.md` `⁸` — by-design; each matrix numbers footnotes for its own footnote set (architecture also has Lit `⁷`).
- **[correctness]** `void group.open(...)` samples after Option C — false positive for unhandledrejection; `#rejectCancel` already `void layer.promise.promise.catch(() => {})`. Awaiters still need `isLayerCancelledError`.
- **[docs]** `packages/core/skills/layers/SKILL.md` omit listing `ResponseArgTuple`/`DismissAllArgs`/… in the public utility row — by-design; cite `EndArgs` only (lean advertise).

## Deferred

Capped or out-of-scope-for-now — reconcile re-vets; remove lines when fixed.

```markdown
- **[severity]** `file:line` — finding (deferred: out of scope | cap | blocked)
```
