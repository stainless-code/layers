# Contributing

`@stainless-code/layers` is a small, freshly extracted library. Before large PRs, please open an issue so we can align on:

- **Public surface** — anything exported from a package entry point (`src/index.ts` / React's `src/index.tsx`, plus Svelte's `src/store.ts`) is the public API and must carry JSDoc that reads well in hovers and published typings. See [`docs/architecture.md`](../docs/architecture.md) for the core + adapter model.
- **Runtimes** — **Node** `^20.19.0 || >=22.12.0` and **Bun** `>=1.0.0` (`package.json` **engines**). The core is zero-dep by design; each adapter package declares its required peer (`react`, `preact`, `svelte`, `vue`, `solid-js`, `@angular/core`).

## Dev workflow

```bash
bun install            # runs `prepare` → Husky git hooks
bun run test           # bun:test unit tests across packages/*/src
bun run test:dom       # vitest + jsdom — per-adapter DOM suites (packages/*/tests-dom)
bun run typecheck      # tsc --noEmit
bun run lint           # oxlint
bun run format         # oxfmt
bun run build          # per-package tsdown → packages/*/dist
bun run check          # build, then format:check + lint:ci + test + test:dom + typecheck (in parallel)
bun run check-updates  # interactive dependency updates (bun update -i --latest)
bun run clean          # remove untracked/ignored build artifacts (keeps .env)
```

CI also runs an **offline markdown link check** (`bun run check:links` — relative links + heading anchors, via [`lychee`](https://lychee.cli.rs); config in `lychee.toml`). To run it locally, install lychee first (`brew install lychee`); it's optional for local dev but gates on CI.

For fast local iteration, the `:changes` variants run only on changed files (working tree + staged + untracked): **`format:changes`**, **`lint:changes`**, **`lint:fix:changes`**, and **`fix:changes`** (lint-fix + format).

The test suite is split by what it needs: `bun:test` for `packages/*/src/**/*.test.ts` (no DOM), and `vitest` + jsdom + each adapter's testing library for `packages/*/tests-dom/**` (real-renderer DOM suites per adapter). Adapter binding tests (`packages/<fw>/src/*.test.ts`) run under `bun:test` with the library or framework module mocked or scoped (`effectScope`/`createRoot`). Root scripts fan out across packages with `bun run --filter '*' <script>`. See [`docs/architecture.md § Test matrix`](../docs/architecture.md#test-matrix).

### `main` and pull requests

Branch **`main`** is the line of development for this personal repo. Open a **pull request** for anything non-trivial and merge after **[CI](workflows/ci.yml)** passes — the single **`CI complete`** job is the unambiguous green/red signal.

```bash
git fetch origin && git checkout main && git pull
git checkout -b your-branch-name
# … commit …
git push -u origin your-branch-name
```

Then open a PR on GitHub into **`main`**.

### Git hooks

[Husky](https://github.com/typicode/husky) + [lint-staged](https://github.com/lint-staged/lint-staged) — see [`.husky/pre-commit`](../.husky/pre-commit). Pre-commit runs **`lint-staged`** only when `CURSOR_AGENT`, `CLAUDECODE`, or `AI_AGENT` is `1` (AI/agent commits). Staged code files get `bun run format:check` (`oxfmt --check`) and `oxlint`; each affected package then runs its full **`typecheck`** and **`test`** scripts, plus **`test:dom`** when that package has a `vitest.config.ts`.

### Style

Match Oxfmt/Oxlint; prefer **straight-line code** and extracted helpers over long nested blocks. Existing source comments are preserved — never delete a `TODO` / `FIXME` / commented-out block without asking (see [`.agents/rules/authoring-discipline.md`](../.agents/rules/authoring-discipline.md)).

### Releases

[@changesets/cli](https://github.com/changesets/changesets) — run **`bunx changeset`** when your PR should bump the version, and commit the `.changeset/*.md` file. The Release workflow opens a "Version packages" PR and publishes to npm on merge via trusted publishing (GitHub OIDC; no `NPM_TOKEN`); Sigstore provenance is auto-generated.

### Issues

Use the [GitHub issue templates](https://github.com/stainless-code/layers/issues/new/choose) — **Bug** vs **Feature / adapter proposal** (see `.github/ISSUE_TEMPLATE/`).

## Agent rules and skills (`.agents/`)

Rules live under **`.agents/rules/`** as `.md` files; skills under **`.agents/skills/<name>/SKILL.md`**. Symlink rules into **`.cursor/rules/`** with the `.mdc` extension and skill directories into **`.cursor/skills/`** (see [`.agents/rules/agents-first-convention.md`](../.agents/rules/agents-first-convention.md)). Inventory and tier system: [`.agents/README.md`](../.agents/README.md) and [`.agents/rules/agents-tier-system.md`](../.agents/rules/agents-tier-system.md).

Thank you for making headless layer/stack UI management reusable across libraries and frameworks.
