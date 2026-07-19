# Blume 1.1.0 upgrade

Bump `apps/docs` from Blume 1.0.4 → 1.1.0.

## Why

- `_`-prefixed `pages/` no longer routed — unblocks safe `pages/_home/*` partials
- `blume audit` + basePath-aware link/SEO checks for `/layers` static deploy
- Native `search.popular` aligns with existing `CURATED_POPULAR`

## In scope

1. Pin + green `validate` / `check --isolated` / `build`
2. Smoke: no `_home` routes in `dist/`; changelog still builds
3. Wire `search.popular` from `CURATED_POPULAR` (keep custom Search/404)
4. CI: `docs:audit` after `docs:build`

## Out of scope

MCP/Ask AI, `<Component>` consolidation, Tabs `param`/`inline`, dropping custom layout overrides.

## Close

Delete this plan on ship. Lift durable Blume limitation changes into `.agents/lessons.md` only if verified.
