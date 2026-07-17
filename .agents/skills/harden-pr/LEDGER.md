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

- **[public-api]** `packages/lit/src/index.ts` `layerClientContext` export — intentional (Solid exports `LayerClientContext`; advanced ContextProvider wiring).
- **[public-api]** `packages/lit/src/index.ts` `StackController` ctor `queued`/`deferClient` + `bindClient` — Lit controller surface needs them for `useQueuedStack` / shared lazy resolve; factories are the supported path; `@internal` JSDoc on `bindClient`.
- **[docs]** `docs/plans/lit-adapter.md` kept until post-merge delete+lift — plan status says so; changeset deferred to publish PR.

## Deferred

Capped or out-of-scope-for-now — reconcile re-vets; remove lines when fixed.

```markdown
- **[severity]** `file:line` — finding (deferred: out of scope | cap | blocked)
```
