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

## Deferred

Capped or out-of-scope-for-now — reconcile re-vets; remove lines when fixed.

```markdown
- **[severity]** `file:line` — finding (deferred: out of scope | cap | blocked)
```
