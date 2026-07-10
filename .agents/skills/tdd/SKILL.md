---
name: tdd
description: Test-driven development with vertical tracer-bullet slices. Use when the user wants TDD or red-green-refactor on a vertical slice.
---

# Test-driven development

Vertical RED→GREEN cycles — **one behavior per loop**, not horizontal "all tests then all code". Aligns with [`tracer-bullets`](../../rules/tracer-bullets.md) and [`verify-after-each-step`](../../rules/verify-after-each-step.md).

## This repo

- Runner split per `docs/architecture.md` § Test matrix:
  - `bun run test` — fans out to every workspace's `src/**/*.test.ts` unit tests (core engine + framework adapter binding, with the framework module mocked or scoped). No DOM.
  - `bun run test:dom` — `packages/*/tests-dom/**` (vitest + jsdom + each adapter's testing library) for real-renderer reactivity, outlet/render, and wrapper behavior.
- Co-locate tests next to the module (`packages/core/src/layerStack.ts` → `packages/core/src/layerStack.test.ts`).
- After each GREEN: format/lint/typecheck per [`verify-after-each-step`](../../rules/verify-after-each-step.md).
- Mock at the **framework module seam** in adapter tests (stub `solid-js` / `@angular/core` / `preact/compat`, or scope via `effectScope`/`createRoot`), never inside `packages/core/src/`. See [`PATTERNS.md`](./PATTERNS.md).

## Workflow

### 1. Planning

Confirm **behaviors** to test (not implementation steps) with the user. Prefer deep modules — small public surface (`LayerClient.open`, `LayerStack`, `layerOptions`), complex internals (phase machine, scope queue, gcTime cache, batched notify).

**Done when:** the behaviors under test are confirmed with the user as observable outcomes through a public seam — not implementation steps.

### 2. Tracer bullet (within slice)

```
RED:   one test for first behavior → bun test <file>   (or test:dom for DOM/render behavior)
GREEN: minimal code to pass → re-run
```

**Done when:** the first behavior has gone RED then GREEN on its touched test file.

### 3. Incremental loop

For each behavior: RED → GREEN → run affected tests. One test at a time; no speculative features.

**Done when:** every planned behavior has its own RED→GREEN cycle and the affected tests pass.

### 4. Refactor

After GREEN — look for duplication, long methods, shallow modules, feature envy. Run `bun test <file>` after each step. **Never refactor while RED.** For production polish on a completed slice, [`harden-pr`](../harden-pr/SKILL.md) lite may run in parallel with tracer-bullet commits.

**Done when:** duplication and shallow-module smells in the slice are resolved with tests green throughout.

## Checklist per cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses the public seam only (LayerClient.open / LayerStack / layerOptions / useStack)
[ ] Test would survive an internal refactor
[ ] Code is minimal for this test
[ ] bun test (or test:dom) passes on touched file(s)
```

## Reference

- Good/bad test patterns + mock boundaries: [`PATTERNS.md`](./PATTERNS.md)
- Slice cadence: [`tracer-bullets`](../../rules/tracer-bullets.md) · Verify: [`verify-after-each-step`](../../rules/verify-after-each-step.md)
