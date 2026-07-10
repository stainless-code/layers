---
description: STOP and run the improve-codebase-architecture skill before structurally significant changes (new package export entry, cross-seam imports, zero-dep core breach, growing folders)
alwaysApply: true
---

# Architecture priming

Most code changes are line-level — an adapter, an option, a phase, a bug fix. They don't need architectural review. **A small minority of changes are structurally significant** and pay back compound interest if reviewed before they land. This rule fires the architecture skill on those signals only, not on every edit.

## STOP if any of these apply

- **New package export entry** in `packages/*/package.json` `exports`
- **Cross-seam import** — an exported entry point reaching into another package's internals, or `packages/core/src/` reaching across a package boundary
- **Zero-dep core breach** — a value import in `packages/core/src/` pulling a framework peer (`react`, `preact`, `svelte`, `vue`, `solid-js`, `@angular/core`)
- **New shared utility** under `packages/*/src/` with **3+ projected consumers**
- **Folder past ~15 files** without a public-surface convention, or a new barrel (this repo is deliberately no-barrel)
- **Moving files across seam boundaries**

For each signal: STOP and run [`improve-codebase-architecture`](../skills/improve-codebase-architecture/SKILL.md) before proceeding.

## Otherwise, proceed normally

Line-level changes **do not trigger this rule**. Use intent-triggered skills (`tdd`, `harden-pr`, etc.).

## Reference

[`improve-codebase-architecture`](../skills/improve-codebase-architecture/SKILL.md) · [`tracer-bullets`](./tracer-bullets.md) · [`docs/architecture.md`](../../docs/architecture.md)
