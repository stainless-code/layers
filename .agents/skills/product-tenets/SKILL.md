---
name: product-tenets
description: The product north-star — four tenets (open & agnostic, composable primitives, production-grade, predictable & type-safe) distilled from TanStack's ethos/tenets. Use when making a design, API, or architecture decision, evaluating a trade-off, justifying a feature, or writing/reviewing a docs/plans entry.
---

# Product tenets (north-star)

Distilled from [TanStack's ethos](https://tanstack.com/ethos) and [product tenets](https://tanstack.com/tenets) — a great inspiration whose work we respect and learn from. These four tenets are the design north-star for `@stainless-code/layers`; reach for them whenever a decision needs justifying. Adopted and adapted to a single-package, zero-dep-core, adapter-layered client library.

## 1. Open, independent, technology-agnostic

A provider-agnostic core; integrations layered on top as optional adapters — never the foundation. Swapping a framework is feasible without rewriting business logic; framework-specific behavior is cordoned off in `packages/<framework>/`.

- Rules out: framework-biased APIs or peer deps in `packages/core/src/` (the zero-dep gate); "all-in on X framework" assumptions; lock-in that forces a rewrite.
- Layers shape: one package, subpath exports per framework, optional peers, `itImportsOnlyFromCore` seam test.

## 2. Composable, platform-aligned primitives

Focused, composable building blocks that embrace the web platform rather than hiding it. Adoptable one piece at a time — no rewrites, no hard coupling. Escape hatches by design: always possible to drop down a level.

- Rules out: designs requiring full rewrites or "all-in" commitments; heavy global singletons; abstractions that hide platform capabilities without escape routes.
- Layers shape: `LayerStack`/`LayerClient` primitives; `StackOutlet` is convenience, not required (`useStackHandles` for headless); standard-schema validation stays a spec, not a dep.

## 3. Pragmatic, production-grade quality

Designed around real-world workloads, edge cases, and long-lived apps — not happy-path demos. Features are not done until we'd run them in our own revenue-critical apps. Performance and scale are requirements, not nice-to-haves.

- Rules out: demo-only features; magic that's impossible to debug; changes that optimize for benchmarks over real-world reliability.
- Layers shape: no-op update skip + stable snapshot refs; sync flush by default (documented `notifyManager.batch` for burst-coalescing); branded errors + `is*` guards.

## 4. Predictable, explicit, type-safe behavior

Minimal magic, maximum clarity. State, side effects, and data flow understandable from code, not hidden behavior. Type safety guides correct use without drowning users in generics. Evolve carefully with clear migration paths.

- Rules out: hidden global state or surprising side effects; API churn without migration; type signatures technically correct but unusable in practice.
- Layers shape: opaque `DataTag` keys with `ResponseOf`/`ErrorOf` inference; `OmitKeyof` key-checked omits; `Register`-driven `DefaultLayerError`; pre-release — no breaking-change constraints, prefer the cleanest correct design.

## Using the tenets

When a proposal conflicts with a tenet, explicitly address why and how the conflict is justified (a `docs/plans/` entry for new surface, inline for a line-level change). Maintainers use these as a PR checklist; partners may not bias core toward a platform.

## Reference

- [TanStack ethos](https://tanstack.com/ethos) · [TanStack product tenets](https://tanstack.com/tenets) — inspiration, with respect.
- [`architecture-priming`](../../rules/architecture-priming.md) — STOP signals for structurally significant changes.
- [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) · [`docs/architecture.md`](../../docs/architecture.md)
