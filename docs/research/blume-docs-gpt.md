# Blume docs research — GPT 5.6

Research pass for public documentation of `@stainless-code/layers` using [Blume](https://useblume.dev/). Consolidated into [`docs/plans/blume-docs-site.md`](../plans/blume-docs-site.md); this file preserves full findings and model-specific rationale.

**Date:** 2026-07-14 · **Model:** GPT 5.6 Terra Medium

---

## Executive summary

Create a dedicated top-level Blume app at `site/`, with source content in `site/content/`. Keep repository docs as contributor/architecture sources; make Blume the canonical public-consumer documentation.

Use shared conceptual guides plus thin framework adapter pages. Do not mirror seven README files verbatim. Phase 1 should deploy static docs; `llms.txt`, raw Markdown, and Copy as Markdown work without a server. Add MCP only after choosing a server-capable host.

> **Note:** Consolidated plan chose `apps/docs/` over `site/`. Placement tradeoffs below remain useful for review.

---

## Site placement decision

| Option                          | Decision                | Tradeoffs                                                                                                      |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `site/` top-level Blume app     | Recommended (this pass) | Clear deploy boundary, own dependencies/config/content, avoids mixing site MDX with repo governance docs.      |
| Reuse `docs/` as Blume root     | No                      | `docs/` contains architecture, plans, audits, research, and generated TypeDoc output—not all public or stable. |
| Add a `packages/docs` workspace | No initially            | Makes deploy/versioning more coupled to packages without a present need.                                       |

Proposed layout:

```text
site/
  blume.config.ts
  package.json
  content/
    index.mdx
    getting-started/
    guides/
    concepts/
    adapters/
      react/
      preact/
      vue/
      solid/
      angular/
      svelte/
    reference/
  public/
```

Keep `docs/architecture.md`, `docs/glossary.md`, and package READMEs as source material initially. Do not mount the entire existing `docs/` folder as a Blume filesystem source: plans such as `docs/plans/layer-handles.md` are explicitly unimplemented and must not become public API documentation.

---

## Navigation design

Use top-level tabs so framework material does not bury core concepts.

```text
Home                           /
Getting started                /getting-started
  Choose your adapter          /getting-started/choose-an-adapter
  Installation                 /getting-started/installation
  First confirm dialog         /getting-started/first-layer

Guides                         /guides
  Define a layer               /guides/define-a-layer
  Mount and render a stack     /guides/render-a-stack
  Open and await a result      /guides/open-and-resolve
  Fire-and-forget notices      /guides/fire-and-forget
  Singleton / live updates     /guides/upsert-and-update
  Serial flows                 /guides/serial-stacks
  Nested layers                /guides/layer-groups
  Transitions                  /guides/transitions
  Guard dismissal              /guides/blockers
  Validate payloads            /guides/payload-validation

Concepts                       /concepts
  Architecture                 /concepts/architecture
  Layer lifecycle              /concepts/lifecycle
  Stacks and scopes            /concepts/stacks
  Type inference               /concepts/type-inference
  SSR posture                  /concepts/ssr
  Glossary                     /concepts/glossary

Adapters                       /adapters
  Overview / comparison        /adapters
  React                        /adapters/react
  Preact                       /adapters/preact
  Vue                          /adapters/vue
  Solid                        /adapters/solid
  Angular                      /adapters/angular
  Svelte                       /adapters/svelte
  Svelte stores                /adapters/svelte/stores

Reference                      /reference
  Core API                     /reference/core
  Adapter API matrix           /reference/adapters
  Package compatibility        /reference/compatibility
  Migration / breaking changes /reference/migration

Changelog                      /changelog
GitHub                         external featured link
```

Configure Blume header tabs for `/guides`, `/concepts`, `/adapters`, and `/reference`. Route-scoped sidebar means the adapter tab only shows adapter material.

---

## Content migration strategy

| Existing source                                       | Destination                                                   | Treatment                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Root `README.md`                                      | Home, installation, adapter picker, first-layer guide         | Split rather than copy. Preserve use-case matrix and React taste example.                     |
| `packages/core/README.md`                             | Core API + headless renderer guide                            | Lift `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, validation, direct-core use.    |
| `docs/architecture.md`                                | Architecture, lifecycle, transitions, SSR, adapter comparison | Primary source, decomposed into reader-sized pages.                                           |
| `docs/glossary.md`                                    | Concepts glossary                                             | Preserve exact terminology; link terms to primary guide.                                      |
| `packages/*/README.md`                                | Adapter overview + seven adapter pages                        | Extract only installation, provider/client acquisition, rendering, adapter-specific wrappers. |
| `typedoc.json` / generated `docs/api`                 | Reference validation input, not initial public source         | Keep in CI; later decide link/deploy vs curated pages.                                        |
| `docs/plans/**`, `docs/research/**`, `docs/audits/**` | Excluded                                                      | Internal, historical, or unimplemented material.                                              |

Each guide should begin with a decision-oriented summary: when to use it, APIs involved, minimal example, framework differences, edge cases.

---

## Blume config sketch

```ts
import { defineConfig } from "blume";

export default defineConfig({
  title: "@stainless-code/layers",
  description:
    "Headless typed layer stacks for modals, dialogs, drawers, popovers, and toasts.",
  github: {
    owner: "stainless-code",
    repo: "layers",
  },

  content: {
    root: "content",
  },

  navigation: {
    tabs: [
      { label: "Guides", path: "/guides", icon: "book-open" },
      { label: "Concepts", path: "/concepts", icon: "layers" },
      { label: "Adapters", path: "/adapters", icon: "plug" },
      { label: "Reference", path: "/reference", icon: "braces" },
    ],
    featured: [
      {
        label: "GitHub",
        href: "https://github.com/stainless-code/layers",
        icon: "github",
      },
    ],
  },

  search: { provider: "orama" },

  ai: {
    llmsTxt: true,
    mcp: {
      enabled: false, // Enable only after server-host decision.
      route: "/mcp",
      name: "@stainless-code/layers docs",
      instructions:
        "Use framework-specific pages for rendering APIs; core guides apply to every adapter.",
    },
  },

  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
    agentReadability: true,
  },

  deployment: {
    output: "static",
    site: "https://layers.stainless-code.dev", // decide actual domain first
  },
});
```

Use MDX for pages requiring `package-install`, callouts, framework tabs, Mermaid lifecycle diagrams, or components. Plain Markdown for prose-heavy reference.

---

## Framework adapter doc pattern

Use a shared **contract + delta** structure:

1. One canonical guide explains `LayerClient`, `layerOptions`, `open`, phases, transitions, blockers, scopes, and validation.
2. Every adapter page contains only:
   - `package-install` block,
   - supported framework/peer range,
   - how the client is provided/read,
   - idiomatic stack rendering,
   - adapter-only ergonomic APIs,
   - links back to shared guides.
3. Use one "same confirm dialog" example across all adapters, changing only framework syntax.

The stable common contract: adapters re-export core, expose a client acquisition mechanism, and bind stack snapshots to framework reactivity. Rendering surface deliberately varies:

- **React/Preact/Vue/Solid:** `StackProvider`, `useLayerClient`, `useStack`, `StackOutlet`.
- **Angular:** `provideLayerClient`, `LAYER_CLIENT`, signal-style `useStack`, imperative `renderStack(vcr)`.
- **Svelte runes:** `setLayerClient`, `useStack().current`, `stack.callFor`.
- **Svelte stores:** `/store`, `Readable`, `$stack`, standalone `callFor`.

This prevents falsely documenting `StackOutlet` as universal while avoiding seven copies of the core lifecycle explanation.

Use Blume `package-install` blocks per adapter. Use framework `<Tabs>` only when code is genuinely parallel; prefer individual adapter pages for larger differences.

---

## CI/CD plan

1. Add `blume` as a dev dependency in `site/package.json` or root workspace tooling.
2. Add root scripts: `docs:dev`, `docs:build`, `docs:preview`.
3. Add CI `Docs site` job to `.github/workflows/ci.yml`:
   - checkout;
   - existing Bun setup;
   - `bun run docs:build`;
   - optionally validate `site/dist/llms.txt`, `llms-full.txt`, `agent-readability.json`.
4. Keep existing `docs-api` TypeDoc job — validates exports independently.
5. Add deployment only on `main`, after CI succeeds:
   - Static hosting enough for Phase 1.
   - Vercel/Netlify/Cloudflare Pages build `site/` and publish `site/dist/`.
   - GitHub Pages viable but needs `deployment.base` for project subpath.
6. Do not attach docs deployment to npm Release workflow initially. Documentation deploys when `main` changes, independent of package version publication.

---

## Phase 1 / Phase 2 / Phase 3 rollout

### Phase 1 — tracer bullet

- `site/` with Blume config and static deployment.
- Home, installation/adapter chooser, React first-layer tutorial.
- One shared guide: "Define, mount, open, resolve."
- Generated `llms.txt`, raw `.md` pages, Copy as Markdown verified on preview.
- CI build gate and production deploy.

Proves source → build → deploy → machine-readable reader path before migrating everything.

### Phase 2 — shared model and adapters

- Migrate architecture into concepts pages.
- Add React, Svelte runes, and Svelte stores first (conventional outlet + two Svelte render paths).
- Add Preact, Vue, Solid, Angular as thin deltas.
- Publish adapter comparison matrix and compatibility page.
- Add lifecycle diagrams, serial queue, layer groups, transitions, blockers, validation, SSR guides.
- Redirect README/package README links to canonical site routes once stable.

### Phase 3 — reference and agent integration

- Curate core/reference API pages from TypeDoc-validated exports.
- Add release changelog source from GitHub Releases if release notes are consistently useful.
- Enable hosted MCP only after `output: "server"` with selected adapter and rate-limit policy.
- Optionally add Blume Ask AI after content coverage is sufficient.

---

## Risks

- **API drift:** library is experimental; layer-handles plan documents future breaking API. Public pages must distinguish shipped APIs from plans.
- **Duplicate truth:** package READMEs, root README, architecture docs, and site can diverge. Declare Blume site canonical for users; reduce package READMEs to install/short-start/link surfaces.
- **Server cost/security:** MCP and Ask AI require server output; Ask AI needs key management and abuse controls. Static Phase 1 avoids both.
- **Seven-way duplication:** writing complete framework guides independently will introduce factual drift. Use canonical guides plus explicit deltas.
- **Domain uncertainty:** no current docs hostname/deployment provider configured. Avoid baking `deployment.site` until chosen.
- **Generated TypeDoc:** `docs/api` is generated beneath general docs tree. Do not ingest as Blume content until navigation/design meets public reference standard.

---

## Unique insights (GPT)

1. **Strongest public narrative is not "a modal library."** It is **typed, imperative layer orchestration**: declare once with `layerOptions`, invoke from anywhere through `LayerClient`, optionally await a typed result.
2. **"Await" should be shown as optional.** `void client.open(...)` is first-class; docs that lead only with confirmation dialogs understate toast, progress, and notification use cases.
3. **Svelte and Angular differences are architectural, not parity gaps.** Document primitive/imperative rendering as intentional compiler-free design.
4. **Blume's agent-facing output fits immediately on static deploy:** `/llms.txt`, `/llms-full.txt`, per-page `.md`, Copy as Markdown, `agent-readability.json`. MCP is valuable but not required for AI-ready docs.
