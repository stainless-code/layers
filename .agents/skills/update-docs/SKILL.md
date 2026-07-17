---
name: update-docs
description: Keep apps/docs in sync with merged product changes. On each run, audit recently merged PRs against docs content, update only drifted pages, verify with blume build, and open or update a blume/* PR — or report a clean no-op.
---

# Update docs — sync apps/docs with merged PRs

Upstream workflow: [`npx skills add haydenbleasel/blume --skill blume-update-docs`](https://github.com/haydenbleasel/blume). This local skill encodes it for scheduled agents in this repo.

## When to use

- **Scheduled** — weekly (or similar) run to catch docs drift from merged PRs.
- **On demand** — after a batch of merged PRs that may have changed public API surfaces, adapter hooks, or Blume config.

## Workflow

1. **Collect merged PRs** in the lookback window (default **7 days**): `git log --since="7 days ago" --merges --first-parent` and `gh pr list --state merged --search "merged:>$DATE"`. _Done: every merged PR in the window listed with title, number, and surfaces touched._
2. **Drop feature-flagged work** — skip PRs/commits touching flag-gated code; never document unreleased surfaces. _Done: flag-gated PRs removed from the list._
3. **Map changed surfaces to docs pages** — trace diffs in `packages/core/src`, `packages/*/src` exports, `blume.config.ts`, and CLI to the pages that document them (`content/reference/core-api.mdx`, `content/reference/adapter-hooks.mdx`, `content/adapters/**`, `content/guides/**`, plus related examples/recipes when behavior changed). _Done: every changed public surface mapped to zero or more docs pages._
4. **Edit only drifted facts** — signatures, option tables, behavior descriptions. Use `<AutoTypeTable>` where types changed (regenerates from source); do not rewrite stable prose. _Done: every drifted fact updated; no stable prose touched._
5. **Verify** — `bun run docs:validate -- --strict && bun run docs:check -- --isolated && bun run docs:build`; fix until green. **Do not commit if any fail.** Per [`verify-after-each-step`](../../rules/verify-after-each-step.md). _Done: all three green._
6. **Open or update a PR** on branch `blume/sync-docs-<date>` with a summary of what drifted and the fixes. Label it **`docs`** so merge deploys the site ([`docs-governance/LIFECYCLE.md`](../docs-governance/LIFECYCLE.md) § README surfaces). Follow commit/PR conventions; never `--no-verify` ([`no-bypass-hooks`](../../rules/no-bypass-hooks.md)). _Done: PR open with `docs` label and drift summary, or step 7 applies._
7. **Clean no-op** — if nothing drifted, report the PRs checked and surfaces audited; **do not open a PR.** _Done: report lists every PR checked and every surface audited._

## Boundaries

- **Only `apps/docs/`** — never edit `docs/` (maintainer-only plans/research); docs-only PRs, never library source.
- **Minimal diffs** — drifted facts only; no cosmetic rewrites, unrelated refactors, or removing source comments in touched files ([`authoring-discipline`](../../rules/authoring-discipline.md)).
- **No PR on a clean no-op; no commit on a failing build.**

## Reference

- Verify loop: [`verify-after-each-step`](../../rules/verify-after-each-step.md) · [`harden-pr`](../harden-pr/SKILL.md) (lite before commit, full before merge)
- Authoring: [`authoring-discipline`](../../rules/authoring-discipline.md)
- Voice/tone/format for the public site (headline grammar, disclaimer wording, do/don't): [`docs-voice`](../docs-voice/SKILL.md)
- Docs site scope: [`docs-governance`](../docs-governance/SKILL.md) (governs `docs/`; this skill governs `apps/docs/` sync only)
