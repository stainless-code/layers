---
description: Authoring discipline for code comments, docs, and committed prose — preserve existing comments, keep new prose concise, never embed brittle anchors in commits.
alwaysApply: true
---

# Authoring discipline (STOP)

**Prose depth:** [`authoring-discipline/PROSE.md`](../skills/authoring-discipline/PROSE.md). **Doc lifecycle:** [`docs-governance`](../skills/docs-governance/SKILL.md).

## Preserve existing source comments (non-negotiable)

**STOP** — never remove comments, TODO/FIXME/HACK, or commented-out code without asking; when restructuring via StrReplace, copy comments into `new_string`. Full checklist: [`authoring-discipline/PROSE.md`](../skills/authoring-discipline/PROSE.md) § Preserve.

User-requested **doc audits** may slim redundant markdown; preservation above applies to **source** comments only.

## New prose + anchors (defaults)

- **Decision test:** re-derivable in 30s? → cut it (details in [`PROSE.md`](../skills/authoring-discipline/PROSE.md)).
- **No brittle anchors** in commits — plain-English decisions; no design-tool node IDs / handoff URLs in source, JSDoc, or tests.
- **End-of-turn:** cut duplicate tables/narration; after doc slim → [`docs-governance/LIFECYCLE.md`](../skills/docs-governance/LIFECYCLE.md) § Existence test + § Cross-reference preservation (or [`docs-lifecycle-sweep`](../skills/docs-lifecycle-sweep/SKILL.md) for a full janitor pass).

Related: [`concise-reporting`](./concise-reporting.md) · [`docs-lifecycle-sweep`](../skills/docs-lifecycle-sweep/SKILL.md).
