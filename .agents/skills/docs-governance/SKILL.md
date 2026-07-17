---
name: docs-governance
description: Repo-wide docs lifecycle — plans, audits, research, README surfaces. Use when authoring or editing any docs/**, README, or other doc-bearing folder.
---

# Docs governance

Repo-wide Tier B surface (cross-cutting reference + lifecycle substrate). This is a small library: no per-feature `docs/` subtrees, no ownership tables. **Full blueprint:** [LIFECYCLE.md](./LIFECYCLE.md).

## Quick rules

Full blueprint: [LIFECYCLE.md](./LIFECYCLE.md) — the shared spine (§1–6: lifecycle types → cross-reference preservation), README surfaces (the `apps/docs` docs site is canonical; package + root READMEs are npm landings only; **`docs` label** on site-touching PRs for FTP deploy), + Closing states (plans / audits / research). This is a small library — no per-feature `docs/` subtrees, no ownership tables.

## Reference

- [`docs-lifecycle-sweep`](../docs-lifecycle-sweep/SKILL.md) — the doc janitor; walks `docs/` and produces a per-file action plan.
- [`docs-governance-priming`](../../rules/docs-governance-priming.md) — Tier 2 priming on doc edits.
- [`authoring-discipline`](../../rules/authoring-discipline.md) — prose density.
