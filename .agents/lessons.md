---
description: Lessons — read when relevant; lift durable corrections into rules/skills
alwaysApply: true
---

# Lessons Convention

## Rules

1. **Read when relevant** — skim when the task matches a bullet below; the file is always attached but read selectively, not a mandatory full read every session.
2. **Append only durable, non-obvious corrections** — not session trivia already in a rule, skill, or reference doc.
3. **Prefer lifting** — when a lesson becomes policy, move it to `.agents/rules/` or the relevant skill and remove the bullet here (or supersede with one line pointing at the rule).
4. **Keep entries atomic** — one lesson per bullet. One sentence.
5. **No duplicates** — merge or supersede instead of appending near-duplicates.
6. **Supersede, don't accumulate** — outdated lesson → one replacement bullet; don't leave both.

<!-- Append durable corrections below, one bullet per line. Keep this file
     short — lift into rules/skills when a lesson becomes policy. -->

- npm trusted publishing (OIDC) needs npm ≥ 11.5.1 + Node ≥ 22.14; oven-sh/setup-bun leaves npm 10.x in PATH, so a release job running `changeset publish`/`npm publish` must also run actions/setup-node (Node 24 → npm 11) or OIDC isn't detected → ENEEDAUTH.
- Don't pin a GitHub action to a moving major tag's commit SHA (e.g. setup-node@<v6-tag-commit>) — the tag moves and orphans/GCs the commit → "unable to find version"; pin to an immutable release-tag commit or use the moving @vN tag.
- Subagent model choice: use `composer-2.5-fast` for fast implementation, `glm-5.2-high` for deeper exploration/design/debate; mix or run both for hard findings.
- Format `apps/docs` non-content files at `printWidth: 80` — oxfmt uses **nearest-config-wins per file**, so the nested `apps/docs/.oxfmtrc.json` (ignore-only → default printWidth 100) shadows root `.oxfmtrc.json` (80) for every `apps/docs/*` file regardless of CLI scope; fix by adding `"printWidth": 80` to `apps/docs/.oxfmtrc.json` (or `-c .oxfmtrc.json --disable-nested-config`). `content/**` stays excluded by the nested ignore so writes won't collapse `:::note` callouts.
- The layers repo has tracked `.oxlintrc.json` + root `.oxfmtrc.json` (since the initial commit) with real plugins/rules/ignorePatterns (`.oxlintrc.json` ignores `**/*.svelte` and `**/*.vue`); merge additions into them — never overwrite/replace. Verify tracked lint/format configs via `git ls-files '*.oxlintrc*' '*oxfmt*'` before touching (3 tracked today: `.oxlintrc.json`, `.oxfmtrc.json`, `apps/docs/.oxfmtrc.json`); the "no oxlint config" explore report was wrong.
- A blume version bump needs `rm -rf .blume .blume-verify` (or a dev-server restart) before trusting build/preview output — `blume build --isolated` always regenerates the runtime, but incremental `writeIfChanged` skips, `ensureDepsLink` no-ops, `blume preview` serving an existing build, and `.blume/.astro` caches can persist stale output and silently mask new markdown/transformer features (e.g. 1.0.4 `blume:table-wrap`), reading as a false upstream regression.
- Blume `<Component>`/islands **hard-cap** live-render at React/Vue/Svelte (+Astro static) — pilot-confirmed in Blume 1.0.4 (`FRAMEWORK_BY_EXT` maps jsx/tsx→react, no solid/preact; generated `astro.config.mjs` only wires react/vue/svelte; no integration hook). Installing `@astrojs/solid-js`/`preact` is inert; `.tsx` always routes to the React renderer (Preact hooks crash, Solid renders broken via React). Non-React recipes are permanently code-only; Vue preview needs `@astrojs/vue` + the `vue.vue` SFC compile fix. (Astro officially also supports Preact/SolidJS/Alpine/Lit; Angular/Qwik community — Blume exposes a strict subset.) [components](https://useblume.dev/docs/content/components), [astro frameworks](https://docs.astro.build/en/guides/framework-components/#official-front-end-framework-integrations).
- Recipes are `?raw`-imported, so `blume build` never typechecks them — gate with `bun run typecheck:recipes` in `apps/docs` (per-framework `tsconfig.recipes-*.json` + `tsconfig.solid.json`/`tsconfig.preact.json` via `vue-tsc`/`svelte-check`/`tsc`; wired into CI as root `typecheck`). (Supersedes the old solid/preact-no-`export default` + `vue.vue` SFC-compile bullet — both fixed; gate is live and green.)
- Recipe files keep their framework-native extension (`vue.vue`, `svelte-runes.svelte`, `angular.ts`) — renaming a Vue SFC to `vue.ts` makes oxlint parse `<template>` as TS and fail (`Expected '>' but found 'Identifier'`) while `?raw` + `blume build` stay green. Gate recipes with `bun run typecheck:recipes` (CI: root `typecheck`); `lint:ci` only covers `.ts`/`.tsx` — `.vue`/`.svelte` are oxlint-ignored.
