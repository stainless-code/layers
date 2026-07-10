---
name: diagnosing-bugs
description: Diagnose hard bugs and regressions. Use when the user says diagnose or debug this, or reports something broken, throwing, failing, or slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring, read `docs/architecture.md` (core/adapter seam + layer lifecycle) for module vocabulary before forming hypotheses.

**Feedback loops (prefer in order):**

1. **Failing `bun test`** — co-located `packages/*/src/**/*.test.ts` at the core + adapter-binding seam (fastest; no DOM)
2. **`bun run test:dom`** — `packages/*/tests-dom/**` for real-renderer reactivity, outlet/render surfaces, and ergonomic wrappers per adapter
3. **Isolated core harness** — construct a `LayerClient` / `LayerStack` and drive `open` / `dismiss` / `scope` / `gcTime` without any framework to reproduce phase / queue / cache paths without a real renderer
4. **Real framework module in a DOM runner** — the adapter's vitest jsdom suite when the bug only shows against a real renderer/subscribe path
5. **Captured trace replay** — a recorded stack snapshot sequence or a `dismiss`/`dismissAll` ordering replayed through the isolated harness

## Phase 1 — Build a feedback loop

**This is the skill.** Spend disproportionate effort here. A tight pass/fail signal for **this bug** beats staring at code.

Done when you can name **one command** that is red-capable, deterministic, fast, and agent-runnable (`bun test <file>` or `bun run test:dom -- <pattern>`). No red-capable command → no Phase 2.

## Phase 2 — Reproduce + minimise

Run the loop; shrink to the smallest scenario that still goes red. Every remaining element must be load-bearing — one stack, one layer, one `open`/`dismiss` sequence, one selector.

**Done when:** minimal repro documented; non-load-bearing steps removed.

## Phase 3 — Hypothesise

Generate **3–5 ranked, falsifiable hypotheses**. Show the list to the user before testing. Bias toward the seams: snapshot referential-stability across `notifyManager.batch`, `AbortController` cancel-on-dismiss racing `loadFn`, scope-queue drain ordering on `dismissAll`, `gcTime` cache restore on re-open, selector identity causing `useSyncExternalStore` loops.

**Done when:** user has seen ranked list before any fix attempt.

## Phase 4 — Instrument

One variable at a time. Tag debug logs `[DEBUG-xxxx]` for cleanup. Perf bugs (snapshot rebuild churn, scope-queue thrash, gcTime cache miss storms): measure first, then bisect.

**Done when:** one hypothesis confirmed or all falsified with evidence.

## Phase 5 — Fix + regression test

Regression test **before** the fix when a correct seam exists — co-locate under `packages/*/src/` (`bun test`) or `packages/<fw>/tests-dom/` (`test:dom`) per the test matrix in `docs/architecture.md`. If no seam exists to test through, document that as an architectural finding (a shallow module worth deepening behind a smaller interface) and track it in `docs/roadmap.md`.

**Done when:** loop is green; regression test added or gap documented.

## Phase 6 — Cleanup + post-mortem

Remove `[DEBUG-...]` logs, delete throwaway harnesses, state the winning hypothesis in the commit message. If prevention needs an architecture change, record specifics in `docs/roadmap.md`.

**Done when:** no debug sediment; commit message states root cause.

## Reference

- [`tracer-bullets`](../../rules/tracer-bullets.md) · [`verify-after-each-step`](../../rules/verify-after-each-step.md) · [`harden-pr`](../harden-pr/SKILL.md) (lite on the fix commit)
- [`docs/architecture.md`](../../../docs/architecture.md) — seam model, layer lifecycle, test matrix
