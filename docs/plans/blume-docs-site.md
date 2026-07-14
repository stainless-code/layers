# Plan: public documentation site (Blume)

Consolidated from three research passes against this monorepo and [Blume](https://useblume.dev/) ([llms.txt](https://useblume.dev/llms.txt), [llms-full.txt](https://useblume.dev/llms-full.txt)).

**Full subagent findings (debate context, rejected alternatives, model-specific nuance):**

- [GLM 5.2 — `docs/research/blume-docs-glm.md`](../research/blume-docs-glm.md) (`docs-site/` placement, Core tab IA, `/guides/inference`)
- [GPT 5.6 — `docs/research/blume-docs-gpt.md`](../research/blume-docs-gpt.md) (contract+delta adapter pattern, positioning narrative, `site/` placement)
- [Opus 4.8 — `docs/research/blume-docs-opus.md`](../research/blume-docs-opus.md) (`apps/docs/` insulation, mermaid architecture, contributor workflow, oxfmt patch alternative)

## Executive summary

- Stand up **Blume in a dedicated workspace at `apps/docs/`**, insulated from library quality gates (`sherif`, `size-limit`, zero-dep guard, `oxfmt`, `lychee`). Do **not** point Blume at root `docs/` — that folder is governance-owned maintainer substrate (`plans/`, `audits/`, `research/`) and must stay unpublished.
- Mirror the library seam in information architecture: **Guides** (task recipes) · **Concepts** (engine model) · **Adapters** (per-framework deltas) · **Reference** (glossary + curated API) · **Changelog** (GitHub Releases). Use Blume **header tabs** so each tab scopes the sidebar — the primary lever for a 7-framework library without 7 duplicate guide trees.
- **One concept, one canonical home.** Lift consumer-facing prose from `docs/architecture.md` into Blume Concepts pages; shrink package READMEs to npm landings (install + taste + link); keep maintainer-only material in-repo per [`docs-governance`](../.agents/skills/docs-governance/SKILL.md).
- **AI-readiness is near-free on static deploy:** `llms.txt`, `llms-full.txt`, raw `.md` URLs, Copy as Markdown, `agent-readability.json`. MCP + Ask AI need `deployment.output: "server"` — defer to Phase 4.
- **Tracer bullet first:** landing + install + one React getting-started page, `blume build` green in CI, preview deploy — then expand adapters, concepts, changelog.

---

## Why Blume

| Need                                       | Blume feature                                                |
| ------------------------------------------ | ------------------------------------------------------------ |
| Markdown-first, zero app boilerplate       | Folder of `.mdx` → production site; `npx blume init`         |
| Multi-framework IA                         | Header tabs scope sidebar per section                        |
| Install snippets per adapter               | `package-install` directive → npm/pnpm/yarn/bun tabs         |
| Side-by-side framework examples            | Built-in `<Tabs>`, `<Steps>`, callouts, Mermaid              |
| Agent consumers (this repo is agent-first) | `llms.txt`, per-page `.md`, optional MCP server              |
| Changelog without double-writing           | `github-releases` content source                             |
| Monorepo edit links                        | `github.dir` points at project root inside repo              |
| Experimental API                           | Banner + stability page; no generated API pages until stable |

Blume builds on Astro/Vite, static by default — fits a library docs site with no server cost in Phase 1.

---

## Site placement

### Decision: `apps/docs/`

| Option                          | Verdict                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/docs/`**                | **Chosen.** App workspace, fenced from `packages/*` publish gates. Matches monorepo convention for non-published apps.                                  |
| `docs-site/` or `site/` at root | Acceptable alternative; less explicit about insulation from library tooling.                                                                            |
| Root `docs/` as Blume content   | **Rejected.** Leaks `plans/`, `audits/`, `research/`; mixes generated TypeDoc (`docs/api`) with authored content; violates `docs-governance` lifecycle. |
| `packages/docs`                 | **Rejected.** `packages/*` implies publishable library; trips `sherif`, `size-limit`, `check:pack`, zero-dep guard.                                     |
| Separate repo                   | **Rejected.** Loses monorepo edit links, colocated changelog, agent-first story.                                                                        |

### Proposed layout

```text
layers/
├── packages/              # unchanged — core + 6 adapters
├── docs/                  # unchanged — maintainer governance (architecture, glossary, roadmap, plans/, research/)
├── apps/
│   └── docs/              # NEW — Blume site
│       ├── package.json   # "@stainless-code/layers-docs", private
│       ├── blume.config.ts
│       ├── tsconfig.json
│       ├── content/       # authored public docs
│       └── public/        # logo, favicon; later: generated TypeDoc
└── package.json           # add "apps/*" to workspaces; docs:* scripts
```

### Monorepo wiring

```jsonc
// root package.json (additions)
"workspaces": ["packages/*", "apps/*"],
"scripts": {
  "docs:dev": "bun run --filter '@stainless-code/layers-docs' dev",
  "docs:build": "bun run --filter '@stainless-code/layers-docs' build",
  "docs:preview": "bun run --filter '@stainless-code/layers-docs' preview",
  "docs:check": "bun run --filter '@stainless-code/layers-docs' check"
}
```

```jsonc
// apps/docs/package.json (sketch)
{
  "name": "@stainless-code/layers-docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "blume dev",
    "build": "blume build",
    "preview": "blume preview",
    "check": "blume check",
  },
  "dependencies": { "blume": "^1.0.3" },
}
```

### Insulation from library gates

| Gate                                               | Action                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `sherif` (`check:deps`)                            | Ignore `apps/docs` — Astro/React deps won't match library pins                                                                                 |
| Root `build` / `test` / `test:dom`                 | Already scoped to `@stainless-code/*-layers`; docs not swept                                                                                   |
| `size-limit`, `knip`, `check:pack`, zero-dep guard | Do not extend to `apps/docs`                                                                                                                   |
| `oxfmt` (`format` / pre-commit)                    | **Exclude `apps/docs/content/**`** — pinned `oxfmt@0.58.0` collapses Blume `:::note` callouts (Blume documents a patch for this exact version) |
| `lychee` (`check:links`)                           | **Exclude `apps/docs/**`** in `lychee.toml` — site-absolute links (`/concepts/...`) false-flag; use `blume validate` for docs                  |
| `.gitignore`                                       | `apps/docs/.blume/`, `.blume-verify/`, `dist/`                                                                                                 |

Node ≥ 22.12 required by Blume; root `engines` already allows `>=22.12.0` — confirm docs CI job uses Node 22+.

---

## Information architecture

Use Blume tabs + `sidebar.display: "group"` for collapsible adapter sections.

```text
Header tabs:  Guides · Concepts · Adapters · Reference
Featured:     Changelog · GitHub

/                                    Landing — pitch, use-case matrix, framework picker
/concepts/stability                  Experimental status, semver, pinning (banner target)

── Guides (task-oriented; framework code via <Tabs>) ──
/guides/getting-started              Install → declare → mount → open+await
/guides/awaiting-results             await open, DataTag inference, fire-and-forget
/guides/singletons                   upsert + update (toasts, progress)
/guides/serial-queues                scope: serial, getQueuedSnapshot
/guides/nested-overlays              layer groups
/guides/animations                   transition axis, delays, call.settle()
/guides/dismissal-blockers           blockers, dismissing, dismissAll modes
/guides/payload-validation           Standard Schema, PayloadValidationError
/guides/error-handling               Promise rejections, narrowing
/guides/headless-rendering           useStackHandles, StackSubscribe, when to skip StackOutlet
/guides/ssr                          per-adapter SSR posture

── Concepts (canonical engine model — lifted from architecture.md) ──
/concepts/when-to-use                Use-case matrix (from root README)
/concepts/overview                   Core + adapter boundary
/concepts/lifecycle                  phase / transition / actionStatus (diagram-first)
/concepts/stacks-scope-gc            named stacks, serial/parallel, gcTime, upsert
/concepts/identity-and-types         key vs instance id, DataTag, Register
/concepts/blockers                   engine-level blocker model (links to guide)
/concepts/notifications              notifyManager batching
/concepts/glossary                   Ubiquitous language (from docs/glossary.md)

── Adapters (tab-scoped sidebar — one framework at a time) ──
/adapters                            Parity matrix (architecture.md § Adapter ergonomics)
/adapters/core                       UI-agnostic engine (packages/core README)
/adapters/react                      packages/react README → thin delta
/adapters/preact
/adapters/vue
/adapters/solid
/adapters/angular                    renderStack(vcr) divergence called out
/adapters/svelte/runes               entry `.` (5.7+)
/adapters/svelte/store                entry `./store` (3+)

── Reference ──
/reference/overview                  How to read reference; TypeDoc link
/reference/core-api                  Curated LayerClient, LayerStack, layerOptions…
/reference/adapter-hooks             Hook signatures matrix
/reference/roadmap                   Lifted from docs/roadmap.md
/reference/migration                 Breaking-change notes when they ship

── Changelog (github-releases source) ──
/changelog                           Timeline + RSS from GitHub Releases
```

**Pedagogy:** navigation teaches the architecture. Concepts = engine (framework-free). Adapters = per-stack binding. Guides = cross-cutting tasks with `<Tabs>` for syntax — **never fork a guide per framework.**

---

## Single source of truth

| Content                                                 | Canonical home                                     | Other surfaces                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Engine model (lifecycle, stacks, blockers, transitions) | Blume `/concepts/*`                                | `docs/architecture.md` slimmed to maintainer slice (invariants, test matrix, isolation) + links to site |
| Glossary                                                | `docs/glossary.md` (governance-owned)              | Imported or copied into `/concepts/glossary`; fix internal links to site-absolute URLs                  |
| Per-adapter getting-started                             | Blume `/adapters/<fw>`                             | Package READMEs → install + ~20-line taste + "Full guide →"                                             |
| When-to-use matrix                                      | Blume `/concepts/when-to-use`                      | Root README keeps teaser + link                                                                         |
| Adapter parity matrix                                   | Blume `/adapters` (one home only)                  | Do not duplicate in architecture.md long-term                                                           |
| Exhaustive symbol list                                  | TypeDoc → `apps/docs/public/api/**` (CI-generated) | Curated `/reference/*` deep-links; keep `docs:api` in CI as validation                                  |
| Changelog                                               | GitHub Releases                                    | `github-releases` source; no hand-maintained changelog                                                  |
| Plans / audits / research                               | In-repo `docs/`                                    | Never published                                                                                         |
| Agent skills (`packages/*/skills`)                      | In-repo                                            | Link to site concepts; don't restate APIs                                                               |

**README drift policy (needs ratification):** make the Blume site canonical for users; shrink npm READMEs until they're too thin to drift. Alternative: keep READMEs canonical and accept drift — worse for a 7-package monorepo.

**Do not auto-import `packages/*/README.md` as Blume filesystem sources.** GitHub-relative links and npm-standalone requirements break clean import.

---

## Content map (migration)

| Source                                                | Destination                                             | Treatment                                              |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `README.md`                                           | `/`, `/guides/getting-started`, `/concepts/when-to-use` | Split: matrix → landing; React taste → getting-started |
| `docs/architecture.md`                                | `/concepts/*`, `/guides/*`, `/adapters`, `/guides/ssr`  | Decompose; demote file to maintainer slice             |
| `docs/glossary.md`                                    | `/concepts/glossary`                                    | Near-verbatim; fix cross-links                         |
| `docs/roadmap.md`                                     | `/reference/roadmap`                                    | Near-verbatim                                          |
| `packages/core/README.md`                             | `/adapters/core`, `/reference/core-api`                 | Lift                                                   |
| `packages/{react,preact,vue,solid,angular}/README.md` | `/adapters/<fw>`                                        | Thin delta only                                        |
| `packages/svelte/README.md`                           | `/adapters/svelte/runes` + `/adapters/svelte/store`     | Two pages — two package entries                        |
| GitHub Releases                                       | `/changelog`                                            | `github-releases` source                               |
| `docs/plans/*`, `docs/research/*`, `docs/audits/*`    | —                                                       | Excluded                                               |
| `docs/api/` (TypeDoc HTML today)                      | `apps/docs/public/api/` (Phase 4)                       | CI-generated; stop committing HTML                     |

---

## `blume.config.ts` (draft)

```ts
import { defineConfig } from "blume";

export default defineConfig({
  title: "Layers",
  description:
    "Headless modal/dialog/drawer/popover/toast manager — open any layer from anywhere. Zero-dep core + React, Preact, Vue, Solid, Svelte, and Angular adapters.",

  logo: { image: "/logo.svg", text: "Layers" },

  banner: {
    content:
      "Experimental — the API may change between minors. Pin your version.",
    link: { text: "Stability & versioning", href: "/concepts/stability" },
    dismissible: true,
    id: "experimental-2026",
  },

  github: {
    owner: "stainless-code",
    repo: "layers",
    branch: "main",
    dir: "apps/docs", // monorepo: correct Edit-on-GitHub links
  },

  lastModified: true, // CI: fetch-depth: 0

  content: {
    sources: [
      { type: "filesystem", root: "content" },
      {
        type: "github-releases",
        prefix: "changelog",
        owner: "stainless-code",
        repo: "layers",
        limit: 100,
      },
    ],
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides", icon: "book-open" },
      { label: "Concepts", path: "/concepts", icon: "layers" },
      { label: "Adapters", path: "/adapters", icon: "plug" },
      { label: "Reference", path: "/reference", icon: "code" },
    ],
    featured: [
      { label: "Changelog", href: "/changelog", icon: "sparkles" },
      {
        label: "GitHub",
        href: "https://github.com/stainless-code/layers",
        icon: "github",
      },
    ],
    sidebar: { display: "group" },
  },

  theme: { accent: "teal", radius: "md", mode: "system" },
  search: { provider: "orama" },

  markdown: {
    code: { icons: true },
    codeBlocks: { theme: { light: "github-light", dark: "github-dark" } },
  },

  toc: { minHeadingLevel: 2, maxHeadingLevel: 3 },

  ai: {
    llmsTxt: true,
    // Phase 4 — requires output: "server" + deploy adapter + API key
    // mcp: { enabled: true, route: "/mcp" },
    // ask: { enabled: true, provider: "gateway", model: "…" },
  },

  seo: {
    og: { enabled: true },
    rss: { enabled: true, types: ["changelog"] },
    sitemap: true,
    robots: true,
    structuredData: true,
    agentReadability: true,
  },

  deployment: {
    output: "static",
    site: "https://layers.stainless-code.dev", // decide domain before launch
  },

  redirects: [
    { from: "/architecture", to: "/concepts/overview", status: 301 },
    { from: "/glossary", to: "/concepts/glossary", status: 301 },
  ],
});
```

### Authoring patterns

- **Install:** ` ```package-install ` fences (MDX-only) per adapter page.
- **Framework parity:** one guide page, `<Tabs>` for React / Preact / Vue / Solid / Angular / Svelte runes / Svelte store.
- **Lifecycle:** Mermaid state diagram on `/concepts/lifecycle` — the `phase × transition` truth table is the #1 confusion point.
- **Type inference:** dedicated content showing `await client.open(...)` inferring `R` via `DataTag` — the library's signature feature; consider Twoslash blocks later.
- **Angular / Svelte:** document imperative/primitive rendering as intentional compiler-free design, not a parity gap.

---

## CI / deploy

### CI (`.github/workflows/ci.yml`)

Add a separate **`docs`** job (do not block `CI complete` on docs churn initially):

1. Checkout with `fetch-depth: 0` (for `lastModified`).
2. Node 22+ (Blume requirement).
3. `bun install`
4. `bun run docs:check` (or `docs:build` + `blume validate`)
5. Optionally assert `dist/llms.txt` and `dist/llms-full.txt` exist post-build.

Keep existing **`docs-api`** TypeDoc job — it validates exports independently of narrative docs.

### Deploy

- **Phase 1:** static host (Vercel / Netlify / Cloudflare Pages / GitHub Pages). Build `apps/docs`, publish `dist/`.
- **Trigger:** deploy on `main` push (docs-only or any); **not** tied to npm release workflow.
- **Phase 4:** if MCP or Ask AI enabled → `deployment.output: "server"` + adapter; `AI_GATEWAY_API_KEY` or provider key; rate limits on `/api/ask`.

### Changelog pipeline

Adopt **changesets linked (or fixed) versioning** so all `@stainless-code/*-layers` packages bump together → **one GitHub Release per version** feeding `/changelog`. Per-package releases create a noisy timeline.

Requirements:

- `GITHUB_TOKEN` in docs build/deploy env for `github-releases` source.
- Redeploy docs on `release` published (webhook or workflow dispatch).

---

## Phased rollout

Aligned with [`tracer-bullets`](../../.agents/rules/tracer-bullets.md): one vertical slice, validate, expand.

### Phase 0 — Ratify (this plan)

- Confirm `apps/docs` placement, README canonical policy, domain/host.
- Architecture-priming: new workspace is structurally significant — this plan satisfies exploration; amend if needed.

**Acceptance:** plan merged or amended; open questions below resolved.

### Phase 1 — Tracer bullet

- `blume init` → `apps/docs` with minimal config above.
- Fence `oxfmt` + `lychee` excludes.
- Pages: landing (`index.mdx`), `/guides/getting-started` (React only), `/guides/install` or install section.
- Root `docs:*` scripts + `docs` CI job.
- Preview deploy.

**Acceptance:** `blume build` green; `blume validate` clean; library `CI complete` unaffected; `llms.txt` emitted with correct `deployment.site` URLs.

### Phase 2 — Concepts + stability

- Author `/concepts/*` from `architecture.md`.
- `/concepts/glossary` from `docs/glossary.md`.
- `/concepts/stability` + experimental banner.
- Slim `docs/architecture.md` to maintainer slice.

**Acceptance:** one canonical page per engine concept; no consumer prose duplicated in `docs/architecture.md`.

### Phase 3 — Guides + adapters

- All `/guides/*` with `<Tabs>`.
- All `/adapters/<fw>` pages; Svelte split (runes + store).
- `/adapters` parity matrix (single home).
- Shrink 7 package READMEs + root README links.

**Acceptance:** no framework-forked guide duplicates; READMEs ≤ ~30 lines prose each.

### Phase 4 — Reference + changelog + AI

- TypeDoc output → `apps/docs/public/api/**` (CI-generated; stop committing `docs/api/**`).
- Curated `/reference/*` with links into TypeDoc.
- Enable `github-releases` changelog; linked versioning in changesets.
- `llms.txt` / `llms-full.txt` quality pass.
- Optional: `output: "server"`, MCP, Ask AI.

**Acceptance:** `/changelog` populated; TypeDoc regenerated in CI; MCP answers a sample agent query (if enabled).

### Phase 5 — Polish

- Custom landing, OG images, redirects for old anchors.
- `blume-update-docs` automation (Blume ships an agent skill for drift audits).
- Close this plan per `docs-governance` lifecycle.

---

## Risks and open questions

| #   | Question                                 | Recommendation                                                               |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | README vs site canonical?                | Site canonical; READMEs thin npm landings                                    |
| 2   | API reference during experimental phase? | Curated guides + glossary; defer full TypeDoc surfacing until API stabilizes |
| 3   | Docs hostname?                           | Decide before setting `deployment.site`                                      |
| 4   | GitHub Pages subpath?                    | Requires `deployment.base`; root domain preferred                            |
| 5   | Linked changesets versioning?            | Adopt before relying on `/changelog`                                         |
| 6   | `layer-handles` plan in flight?          | Badge/callout APIs in flux; don't document unshipped renames as current      |
| 7   | Ask AI cost/abuse?                       | Unauthenticated endpoint — rate limits + spend caps if enabled               |

### Anti-patterns (consensus)

- Letting `oxfmt` format MDX content.
- Running `lychee` over Blume-authored links.
- Putting the site under `packages/`.
- Publishing `docs/plans/` or `docs/research/`.
- Auto-importing 7 READMEs verbatim.
- Forking guides per framework (6× "serial queues" pages).
- Hand-maintaining 130+ TypeDoc HTML pages in git.
- Per-package GitHub Releases → noisy changelog.
- Blocking library CI on docs failures (keep jobs separate initially).

---

## Cross-agent insights worth keeping

1. **Blume tabs solve the 7-framework IA problem** — scoped sidebar per adapter tab; don't flatten into one tree.
2. **AI features are asymmetric value** for a headless library users ask agents about ("open confirm from route guard, await in React"). Prioritize `llms-full.txt` prose quality; MCP in Phase 4.
3. **The three-axis model deserves diagram-first treatment** — `phase` / `transition` / `actionStatus` on `/concepts/lifecycle`.
4. **Navigation is pedagogy** — Concepts / Adapters / Guides mirrors core/adapter seam.
5. **Experimental is an asset if framed with design rigor** — link stability page to adversarial design process (e.g. layer-handles plan).
6. **Svelte two-entry case** (`./` vs `./store`) is an early IA proof — two sibling pages under `/adapters/svelte/`, not two packages.
7. **Changelog via `github-releases`** is high-ROI for a changesets repo — zero double-writing once linked versioning is adopted.

---

## Next action

Run Phase 1 tracer bullet: `npx blume init` in `apps/docs`, one React getting-started page, CI job, preview deploy. Resolve open question #3 (domain) in parallel.
