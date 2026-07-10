# Docs

Repo-wide documentation hub for `@stainless-code/layers`. The package landing page is the root [`README.md`](../README.md) (install, quick start); this folder holds maintainer-facing reference and forward-looking work.

## Reference

- [`architecture.md`](./architecture.md) — the headless core + adapter model, entry-point layout, and the layer lifecycle. Brief; the full API contract lives in the JSDoc of each module.
- [`glossary.md`](./glossary.md) — ubiquitous language for the layer/stack domain (layer, stack, client, phase, transition, call context, scope, gcTime, upsert, settle, blocker, dismissing, observer).
- [`roadmap.md`](./roadmap.md) — forward-looking work only, not a mirror of `src/`.

## Lifecycle folders

- [`plans/`](./plans/) — in-flight work commits here; deleted + lifted when it ships.
- [`audits/`](./audits/) — targeted audits; closed per the lifecycle in `.agents/skills/docs-governance`.
- [`research/`](./research/) — tool / approach evaluations; closed per the lifecycle.

Each folder carries a `.gitkeep` so it stays discoverable when empty.

> **Governance:** this README follows the [`docs-governance` skill](../.agents/skills/docs-governance/SKILL.md) — repo-wide Tier B surface: cross-cutting reference + lifecycle substrate, no feature-specific rules.
