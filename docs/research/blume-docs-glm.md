# Blume docs research — GLM 5.2

Research pass for public documentation of `@stainless-code/layers` using [Blume](https://useblume.dev/). Consolidated into [`docs/plans/blume-docs-site.md`](../plans/blume-docs-site.md); this file preserves full findings and model-specific rationale.

**Date:** 2026-07-14 · **Model:** GLM 5.2 High

---

## Executive summary

- **Co-locate the site as a bun workspace at `docs-site/`** (not under `docs/`). The existing `docs/` is a maintainer-facing governance substrate (architecture, glossary, roadmap, plans, research) governed by the `docs-governance` skill — repurposing it would collide with that lifecycle and with Blume's `content.root` scanning. A dedicated `docs-site/` workspace keeps Blume's `.blume/`/`dist/` build artifacts, `blume.config.ts`, and Astro runtime out of the source tree and lets `blume` resolve via the workspace.
- **Information architecture mirrors the library's package boundary**: a _Core_ tab (UI-agnostic engine), an _Adapters_ tab (one section per framework, scoped sidebar via Blume tabs), a _Guides_ tab (cross-cutting concepts that aren't framework-specific), and a _Reference_ tab (API + glossary). This maps 1:1 to how the library is actually consumed and to the `@stainless-code/layers` + 6 adapter package split.
- **Content is lifted, not copied**: the public user-facing prose already exists — root `README.md` (use-case matrix, React taste), `docs/architecture.md`, `docs/glossary.md`, `docs/roadmap.md`, and each `packages/*/README.md`. The plan moves user-facing pages into `docs-site/src/content/` and _leaves_ `docs/plans/`, `docs/research/`, `docs/audits/` in place (internal lifecycle, not user docs — `docs/README.md` says so explicitly).
- **AI-readiness is Blume's killer feature for this library** and is nearly free: `llms.txt` + `llms-full.txt` + raw `.md` URLs are on by default. The MCP server and Ask AI need `deployment.output: "server"` — gate those behind Phase 3, keep Phase 1 static.
- **Tracer bullet first**: one install page + one React quickstart + the config file, built and deployed, _before_ migrating the other 6 adapters or the architecture deep-dive. Matches the repo's `tracer-bullets` rule.

> **Note:** Consolidated plan chose `apps/docs/` over `docs-site/` for stronger insulation from library gates. Rationale for `docs-site/` at root remains valid as an alternative; see Opus research for the `apps/docs` argument.

---

## Recommended site location in monorepo

```
layers/
├─ packages/            # unchanged — core + 6 adapters
├─ docs/                # unchanged — maintainer governance substrate
├─ docs-site/           # NEW bun workspace
│  ├─ package.json      # name: "@stainless-code/layers-docs", private, dep on "blume"
│  ├─ blume.config.ts
│  ├─ tsconfig.json     # extends astro/tsconfigs/strict, includes .blume types
│  ├─ public/           # logo.svg, favicon, og images
│  └─ src/content/      # the actual user-facing docs tree
└─ package.json         # add "docs-site" to workspaces, add root scripts
```

**Why `docs-site/` and not `docs/`:**

- `docs/` is explicitly a _maintainer-facing reference + lifecycle substrate_ (`docs/README.md`), governed by `docs-governance`. Blume's `content.root` would scan `plans/`, `research/`, `audits/` — internal work artifacts that must not ship as user docs.
- Blume writes a generated `.blume/` runtime + `dist/` next to its config; you don't want that churn inside `docs/` (which `check:links` via lychee and `docs-governance` lifecycle sweeps operate on).
- A workspace gets `blume` resolved through `bun install` like every other package, and the root `--filter` script fan-out pattern extends naturally: `bun run --filter '@stainless-code/layers-docs' build`.

**Root `package.json` additions** (sketch):

```jsonc
"workspaces": ["packages/*", "docs-site"],
"scripts": {
  "docs:dev": "bun run --filter '@stainless-code/layers-docs' dev",
  "docs:build": "bun run --filter '@stainless-code/layers-docs' build",
  "docs:preview": "bun run --filter '@stainless-code/layers-docs' preview",
  "docs:check": "bun run --filter '@stainless-code/layers-docs' check"
}
```

The repo already has a `docs:api` script running `typedoc` → `docs/api`. That output is generated and should _not_ live inside Blume's content root.

---

## Proposed IA / sidebar

Use Blume **header tabs** (each tab scopes the sidebar to its `path`) plus generated sidebar with `meta.ts` per folder. `display: "group"` so adapter sections collapse.

```
Tabs:   Guides · Core · Adapters · Reference · Changelog
```

**`/` (no tab)** — landing page: hero, use-case matrix from README "When to use it", framework picker cards linking into each adapter quickstart.

**Guides** (`/guides/*`) — cross-framework concepts:

- Getting started (install, the 3-step declare→mount→await model)
- Layer lifecycle (`pending → active → dismissed → exiting → removed → cached`)
- Transitions (`phase` / `transition` / `actionStatus` — three orthogonal axes)
- Blockers & dismissal (`addBlocker`, `dismissAll` modes, `dismissing`)
- Stacks, scope, gcTime (named stacks, serial queue, `getQueuedSnapshot`, caching)
- Layer groups (nested/child stacks, `childStackId`, event-driven drain)
- Payload validation (Standard Schema, `PayloadValidationError`)
- Error handling (`Promise<R>`, why rejections aren't typed, `isPayloadValidationError`)
- Headless rendering (`useStackHandles`, `StackSubscribe`, when to skip `StackOutlet`)

**Core** (`/core/*`) — `@stainless-code/layers` (zero-dep engine), from `packages/core/README.md`:

- Overview / when to use core directly
- `LayerClient` API
- `layerOptions` / `layerKey` / `DataTag` inference
- `createCallContext` / call handle
- `notifyManager` batching
- `Register` / `DefaultLayerError`

**Adapters** (`/adapters/*`) — one section per framework, tab-scoped sidebar:

- `react/`, `preact/`, `vue/`, `solid/`, `angular/`, `svelte/` (two sub-pages: `runes` and `store`)
- Cross-adapter **comparison** page — capability matrix from `docs/architecture.md` § Adapter ergonomics at `/adapters` index

**Reference** (`/reference/*`):

- Glossary — from `docs/glossary.md`
- API reference — link out to TypeDoc `docs/api` for Phase 1; evaluate Markdown mount later
- Roadmap — from `docs/roadmap.md`
- SSR posture — per-adapter table from `docs/architecture.md`

**Changelog** (`/changelog/*`) — `github-releases` source pointed at `stainless-code/layers`.

---

## Content map (source → target page)

| Source file                                        | Target                                                          | Treatment                                                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md` (root)                                 | `/` landing + `/guides/getting-started`                         | Lift use-case matrix → landing cards; React taste → React quickstart; Concepts bullets → Guides intros                                      |
| `docs/architecture.md`                             | `/guides/*` (split) + `/adapters` comparison + `/reference/ssr` | **Split**, don't copy whole. Package-boundary + ergonomics matrix → `/adapters` index; SSR → `/reference/ssr`. Keep file as maintainer doc. |
| `docs/glossary.md`                                 | `/reference/glossary`                                           | Near-verbatim lift                                                                                                                          |
| `docs/roadmap.md`                                  | `/reference/roadmap`                                            | Near-verbatim lift                                                                                                                          |
| `packages/core/README.md`                          | `/core/*`                                                       | Lift + restructure                                                                                                                          |
| `packages/*/README.md`                             | `/adapters/<fw>/*`                                              | Lift; `package-install` blocks for install                                                                                                  |
| `packages/svelte/README.md`                        | `/adapters/svelte/runes` + `/adapters/svelte/store`             | **Split into two pages**                                                                                                                    |
| `.changeset/` + GitHub Releases                    | `/changelog/*`                                                  | `github-releases` source                                                                                                                    |
| `docs/plans/*`, `docs/research/*`, `docs/audits/*` | **Not migrated**                                                | Internal lifecycle                                                                                                                          |
| `docs/api/` (TypeDoc)                              | `/reference/api` (external link)                                | Phase 1 link out                                                                                                                            |

---

## Blume config sketch

```ts
// docs-site/blume.config.ts
import { defineConfig } from "blume";

export default defineConfig({
  title: "@stainless-code/layers",
  description:
    "Headless manager for modal/dialog/drawer/popover/toast UI — open any layer from anywhere, manage it as an ordered, named stack. Zero-dep core + React, Preact, Vue, Solid, Angular, Svelte adapters.",

  logo: { image: "/logo.svg", text: "layers" },
  github: {
    owner: "stainless-code",
    repo: "layers",
    branch: "main",
    dir: "docs-site", // monorepo: path from repo root to project root
  },
  lastModified: true,

  content: {
    root: "src/content",
    sources: [
      { type: "filesystem", root: "src/content" },
      {
        type: "github-releases",
        prefix: "changelog",
        owner: "stainless-code",
        repo: "layers",
      },
    ],
  },

  navigation: {
    sidebar: { display: "group" },
    tabs: [
      { label: "Guides", path: "/guides", icon: "book-open" },
      { label: "Core", path: "/core", icon: "boxes" },
      { label: "Adapters", path: "/adapters", icon: "plug" },
      { label: "Reference", path: "/reference", icon: "dictionary" },
      { label: "Changelog", path: "/changelog", icon: "history" },
    ],
    featured: [
      {
        label: "GitHub",
        href: "https://github.com/stainless-code/layers",
        icon: "github",
      },
    ],
  },

  theme: { accent: "teal", radius: "md", mode: "system" },
  search: { provider: "orama" },

  markdown: {
    code: { icons: true },
    codeBlocks: { theme: { light: "github-light", dark: "github-dark" } },
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  deployment: {
    output: "static",
    site: "https://layers.stainless-code.dev",
  },

  ai: {
    llmsTxt: { enabled: true },
    // mcp: { enabled: true, route: "/mcp" },  // Phase 3 — needs server output
    // ask: { enabled: true, provider: "gateway", model: "openai/gpt-5.5",
    //        suggestions: [
    //          { label: "How do I await a modal's result?", icon: "help-circle" },
    //          { label: "How do I open a layer from a route guard?", icon: "route" },
    //          { label: "How do I animate enter/exit?", icon: "sparkles" },
    //        ] },
  },

  seo: {
    og: { enabled: true },
    rss: { enabled: true, types: ["changelog"] },
    sitemap: true,
    robots: true,
    structuredData: true,
    agentReadability: true,
  },

  redirects: [{ from: "/architecture", to: "/guides/lifecycle", status: 301 }],
});
```

**Multi-package install tabs** — every adapter page uses `package-install` (MDX-only). Svelte: same install block on both pages; divergence is in import path.

**Framework-specific sections** — use `<Tabs>` on cross-framework Guides pages for the same concept in each adapter's syntax.

---

## Monorepo-specific concerns & solutions

| Concern                                 | Solution                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| **`blume` resolution**                  | `docs-site` workspace; `blume` in `dependencies`; Node ≥ 22.12 |
| **Edit-on-GitHub links**                | `github.dir: "docs-site"`                                      |
| **`lastModified` git dating**           | Non-shallow checkout in CI (`fetch-depth: 0`)                  |
| **Content root collision with `docs/`** | `docs-site/src/content`, not `docs/`                           |
| **`sherif`**                            | `docs-site` declares `blume` as real dependency                |
| **Root `lint-staged`/pre-commit**       | Confirm `oxfmt` won't break `.mdx`; exclude if needed          |
| **TypeDoc `docs/api`**                  | Don't put in Blume content root; link out Phase 1              |
| **`blume dev` vs `blume build`**        | `blume build --isolated` in CI; gitignore `.blume/`, `dist/`   |
| **Two Svelte entries**                  | Two pages under `/adapters/svelte/`, not two packages          |
| **Search across 7 frameworks**          | `search.tags: [<fw>]` on adapter pages                         |

---

## Phase 1 tracer bullet

1. Create `docs-site/` workspace + `package.json` + minimal `blume.config.ts`.
2. Add to root `workspaces` + `docs:*` scripts.
3. Landing (`index.mdx`) — hero + use-case matrix.
4. `/guides/install` with `package-install`.
5. `/adapters/react/quickstart` — React taste example.
6. `meta.ts` for `/guides` and `/adapters/react` only.
7. `blume build` → verify `llms.txt` + raw `.md` URLs.
8. Preview deploy; `sherif`/`knip` green.

**Then:** Phase 2 (other adapters + Guides from architecture), Phase 3 (server + MCP + Ask AI), Phase 4 (API reference reconciliation).

---

## Risks & open questions

1. **README ↔ docs-site duplication** — recommend site canonical + README pointer; needs maintainer decision.
2. **API reference strategy** — link out Phase 1; hand-written type tables may read better than TypeDoc during experimental phase.
3. **Server output for AI** — MCP + Ask AI need host + API key; GitHub Pages = static only.
4. **Changelog via `github-releases`** — confirm releases are published, not just tags.
5. **`blume` version / Node** — CI must use Node 22+.
6. **Mermaid for lifecycle** — must be in `.mdx`, not `.md`.
7. **`agents-first-convention`** — if docs authoring skill/rule added, follow symlink convention.
8. **Ask AI cost abuse** — rate limiting if enabled.

---

## Unique insights (GLM)

1. **7-framework split = Blume tab-scoped sidebar.** Don't flatten into one bloated sidebar.
2. **AI-readability is asymmetric value** for a headless library — MCP is the biggest leverage point for "open any layer from anywhere."
3. **`DataTag`/inference is the signature feature** — dedicated `/guides/inference` page showing `await client.open(...)` inferring `boolean`.
4. **`phase`/`transition`/`actionStatus` is novel and confusing** — Mermaid + `<Tabs>` with/without delays across frameworks.
5. **Don't generate API reference until stable** — experimental API + TypeDoc = liability.
6. **Svelte two-entry case** — two sibling pages under `/adapters/svelte/`, not two packages.
7. **Changelog via `github-releases`** — high-ROI for changesets repo; scoped-tag pagination handled automatically.
