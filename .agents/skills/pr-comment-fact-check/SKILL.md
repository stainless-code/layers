---
name: pr-comment-fact-check
description: STOP and fact-check PR review comments before applying or dismissing reviewer or bot feedback. Use on CodeRabbit, Copilot, Cursor bot, dependabot, or human reviewer comments.
---

# PR comment fact-check

**STOP** before applying or dismissing any PR comment. Each comment is a **claim** — verify against the actual code and this repo's authoritative sources (`.agents/`, `docs/architecture.md`, JSDoc, tests) before acting. **Workflow:** [WORKFLOW.md](./WORKFLOW.md).

| Verdict         | Default action                                                       |
| --------------- | -------------------------------------------------------------------- |
| ✅ Correct      | Apply + resolve                                                      |
| ⚠️ Partial      | Apply salvageable part + explain nuance                              |
| ❌ Hallucinated | Push back with evidence; resolve-on-merge-gate exception in WORKFLOW |
| 🕒 Outdated     | Point at fix commit + resolve                                        |
| 💭 Style        | Apply if cheap, else defer                                           |

## Hallucination catalog (scrutinize harder)

Common LLM-reviewer patterns on this repo:

1. **"This isn't tested" without checking siblings** — core contracts are pinned across `packages/core/src/layerStack.test.ts` (open/dismiss/scope/gcTime/loadFn cancel, transitions `enteringDelay`/`exitingDelay`/`settle`, blockers `addBlocker`/`dismissing`/async veto, `dismissAll` modes); each framework adapter has co-located tests under `packages/<fw>/src/`; real-renderer paths span `packages/*/tests-dom/**` (vitest, rerender/detach — e.g. React `confirm.test.tsx`, `blocker.test.tsx`, `transition.test.tsx`). Import isolation is enforced by package manifests, `sherif`, and workspace-aware `knip`, not an `itImportsOnlyFromCore` test. Verify coverage before accepting.
2. **Type-safety alarms** — if `bun run typecheck` passes, the claim is almost always wrong, or about runtime behavior the type system can't see (then the reviewer must justify with the runtime case).
3. **Generic "best practice" claims unsupported by our rules** — "always destructure", "prefer interfaces over types", "add `useMemo`/`useCallback`" — stylistic; we either have a rule or we don't. Grep `.agents/` for the convention.
4. **Convention citations that don't exist** — "this breaks the library's API conventions" — grep `.agents/` + `docs/architecture.md`. If not codified, it's preference, not rule.
5. **Memory-leak / race-condition claims with no concrete trigger** — "this could leak" without a scenario is speculation; ask for the path. Real candidates here: `notifyManager.batch` flushing, `AbortController` cancel on dismiss, `gcTime` cache teardown, `useSyncExternalStore` unmount-detach, the scope queue draining on `dismissAll` — demand the specific path.
6. **Wrong API for our seam** — bot suggests reaching into `LayerStack` internals from an adapter when the seam is `subscribe`/`getSnapshot`; suggests a per-adapter core fork when the core/adapter seam is meant to keep one engine across all frameworks.
7. **Public-API suggestions that leak internals** — `createCallContext` is public and intentionally generic; `Layer`'s `#state` and `LayerStack`'s `#layers` / `#snapshot` / `#queuedSnapshot` / `#scopeQueue` / `#gcCache` / `#blockers` are deliberately private. Push back on "export this helper" / "tighten this to the internal type".

## Anti-patterns

- ❌ Applying every suggestion to clear the queue.
- ❌ Replying "fixed!" without verifying.
- ❌ Dismissing without evidence.
- ❌ Resolving a thread you rejected as hallucinated (the reviewer needs to see the receipts).

## Reference

- [`verify-after-each-step`](../../rules/verify-after-each-step.md) — run after applying a fix.
- [`harden-pr`](../harden-pr/SKILL.md) — optional full pass on the branch once comments are triaged.
- `docs/architecture.md` — seam model, public-surface policy, test matrix (authoritative for "is this the right seam / is this tested" claims).
