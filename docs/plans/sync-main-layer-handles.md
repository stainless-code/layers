# Sync `docs/blume-docs-plan` → `main` (PR #4 layer handles)

Adopt [PR #4](https://github.com/stainless-code/layers/pull/4) (`feat: layer handles and cancelQueued by id`, merge `0cd5770`) into the Blume docs branch without losing the public docs site work.

**Out of scope / leave alone:** `docs/research/modal-overlay-landscape-centralized.md` (local untracked) — do not commit, delete, or fold into this plan.

## Status snapshot (audit date)

| Item                     | Value                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Branch                   | `docs/blume-docs-plan` @ `0d5517a` (tracks `origin/docs/blume-docs-plan`)                      |
| Merge-base               | `f456c64` (`chore: release v0.1.0`)                                                            |
| `origin/main`            | `0cd5770` = PR #4 merge                                                                        |
| Divergence               | Branch **3 ahead / 1 behind** main                                                             |
| Overlap (conflict) files | **18** — all docs/README/skill surfaces; **zero** `packages/*/src` or `tests-dom` file overlap |
| Branch-only              | ~267 paths (mostly `apps/docs/**`)                                                             |
| Main-only (PR #4)        | ~57 paths (core + adapters + changesets + tests)                                               |

Audit inputs: [API surface](22fb1bee-a0f3-457f-9e4c-5103ab33ea44) · [conflict table](a4d2aae6-0846-4202-8520-0cc3428133d9) · [apps/docs drift](444b761b-c9e9-4d0a-95e0-43adcaa8a26f) · [semantics](38ee8073-8b57-494c-ad06-569a42fe3889).

---

## What PR #4 shipped (must land intact)

### Core

- `createLayer(options, client)` → `LayerHandle` / `ValidatedLayerHandle` (payload-only `open`/`upsert`; `dismiss`/`update`/`cancelQueued` with optional `{ id }`; live `current`; exposes `client`/`stack`/`options`).
- `LayerStack.cancelQueued(key, response, opts?: { id? })` — omit `id` = FIFO head; with `id` = exact queued instance.
- `LayerStack.find` = **topmost** same-key (`findLast`).
- Changesets: `.changeset/layer-handles.md` (minor × 7 packages, 0.x breaking migration prose) + `.changeset/cancel-queued-by-id.md` (minor, core).

### Adapter reshape (breaking at 0.x)

| Role                  | React / Preact / Vue / Solid                 | Angular                          | Svelte (runes + store)   |
| --------------------- | -------------------------------------------- | -------------------------------- | ------------------------ |
| Drive (wired handle)  | `useLayer(options)`                          | `injectLayer` (`useLayer` alias) | `createLayer`            |
| Observe mounted       | `useLayerState({ key, … })` → `LayerState[]` | `injectLayerState`               | `createLayerState`       |
| Observe queued stack  | `useQueuedStack({ … })`                      | `injectQueuedStack`              | `createQueuedStack`      |
| Observe queued by key | `useLayerQueuedState({ key, … })`            | `injectLayerQueuedState`         | `createLayerQueuedState` |
| Stack subscribe       | `useStack({ stack?, select?, compare? })`    | same options bag                 | same options bag         |

**Removed (not aliased):** positional `useLayer(key, stack?, compare?)` → single `LayerState | null`, and positional `useStack(stackId, selector?, compare?)`.

### Canonical consumer paths (both first-class)

1. Bag form — `client.open({ …layerOptions, payload })` (still supported).
2. Wired handle — `const c = useLayer(confirm); await c.open(payload)` (recommended adapter ergonomics).

`layerOptions` remains the shared declaration primitive.

---

## Git strategy

**Use `git merge origin/main` — not rebase.**

Why:

- Branch carries ~238 new `apps/docs` files across a few large commits; rebase would re-fight the same 18 doc conflicts per replayed commit.
- Package **source** trees do not overlap — PR #4 `.ts` / `tests-dom` land cleanly; branch only touches `packages/core/src/dataTag.ts` (formatting).
- One conflict-resolution pass, then a separate docs-adoption commit (or tracer slices — see Phases).

```bash
git checkout docs/blume-docs-plan
git fetch origin main
# Leave docs/research/modal-overlay-landscape-centralized.md untracked
git merge origin/main
# resolve 18 conflicts (below)
# do NOT add the modal-overlay research file
```

After conflict resolution: commit the merge, then run Phase B–D as follow-up commit(s) on the same branch (or one commit if preferred — do **not** split the merge itself).

---

## Phase A — Resolve the 18 conflicts

**Tension:** branch slimmed npm READMEs / root README to Blume landings; main added PR #4 API prose into those same files. Blume site is canonical (docs-governance README surfaces) — do **not** restore long GitHub tutorials into package READMEs.

### Resolution rules

| Surface                                  | Rule                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skills (`packages/*/skills/**/SKILL.md`) | **Main API body** + **branch Blume `sources` / when-to-use URLs**                                                                                                   |
| Package READMEs                          | **Branch landing shell** (logo, tagline, `## Docs` → site) + **main taste** (`useLayer` / `injectLayer` / Svelte `createLayer`) — no restored API tables            |
| Root `README.md`                         | **Branch landing + Docs links** + port main’s wired-handle taste + one Concepts line for handles/observe split                                                      |
| `docs/architecture.md`                   | **Main body** (createLayer / drive vs observe / options-bag / find+cancelQueued) + **branch outbound Blume links**                                                  |
| `docs/glossary.md`                       | **Prefer main** (7–8 new terms); re-apply branch adapter list order if it diverged (`core → react → preact → solid → angular → vue → svelte`)                       |
| `docs/roadmap.md`                        | **Union:** keep branch Adapters (Qwik/Alpine/Marko/…) + Docs site (Blume) section; **restore** main’s `LayerStack.setOptions` backlog bullet (handle-aware wording) |

### Conflict order (minimize thrash)

1. `docs/glossary.md`
2. `docs/architecture.md`
3. `docs/roadmap.md`
4. All 7 skills
5. All 7 package READMEs
6. Root `README.md` last

### Post-merge smoke (before apps/docs edits)

```bash
bun install   # if lockfile moved
bun run --filter ./packages/core test
bun run --filter ./packages/react test
# optional: bun run check when time allows
```

---

## Phase B — Make `apps/docs` typecheck-correct (P0)

Without this, `typecheck:recipes` and live demos break against merged adapters.

### B1. Mechanical `useStack` options-bag

Replace positional `useStack("id")` / `useStack("id", selector)` with `useStack({ stack: "id" })` / `useStack({ stack: "id", select })` in:

- `apps/docs/pages/_home/adapter-snippets.ts` (2×)
- `apps/docs/islands/HeroDemo.tsx`, `ToastExample.tsx`
- **All 20** Svelte recipes (`svelte-runes.svelte` + `svelte-store.svelte` under each recipe)
- Prose/examples in `guides/headless-rendering.mdx`, adapter Svelte pages, etc.

### B2. Rewrite stale hook reference (highest-effort page)

`apps/docs/content/reference/adapter-hooks.mdx` — full rewrite:

- `useLayer(options)` = wired handle (`state` / `queued` / `top` + control)
- Observe: `useLayerState` / `useLayerQueuedState` / `useQueuedStack` / `useStack` (options bag → `LayerState[]`)
- Per-adapter rename map (Angular `inject*`, Svelte `create*`)
- Drop every positional signature sketch

### B3. Adapter pages (8)

`adapters/index.mdx`, `react`, `preact`, `vue`, `solid`, `angular`, `svelte/runes`, `svelte/store`:

- Primitives tables: remove `useLayer(key) → LayerState | null`
- Document drive vs observe; Angular `injectLayer*`; Svelte `createLayer*`
- Footnotes that still say `useStack(stack, selector)` → options bag

### B4. Core + concepts + guides (wrong signatures)

| File                            | Edit                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference/core-api.mdx`        | `createLayer` / handles; `cancelQueued(…, { id? })`; `find` = topmost                                                                        |
| `reference/migration.mdx`       | **Replace** “No breaking-change migration notes have shipped yet” with real 0.x note from `.changeset/layer-handles.md` (before/after Diffs) |
| `concepts/overview.mdx`         | `useStack({ stack, select, compare })`                                                                                                       |
| `guides/ssr.mdx`                | `useLayer → null` → `useLayerState` empty-array / selector behavior                                                                          |
| `guides/headless-rendering.mdx` | All positional `useStack` examples                                                                                                           |

### B5. Gate

```bash
cd apps/docs && bun run typecheck:recipes
bun run docs:validate -- --strict   # if CI gate present
# after API regen: bun run docs:api && blume build (rm -rf .blume .blume-verify if cache lies)
```

---

## Phase C — Teach handles (P1 coverage)

Min-viable teaching set (order matters):

1. **`concepts/glossary.mdx`** — port terms from merged `docs/glossary.md`: `createLayer`, `LayerHandle`, `ValidatedLayerHandle`, `useLayer`, `useLayerState`, `useLayerQueuedState`, `useQueuedStack`, `cancelQueued` (`{ id }`), `current`; sharpen drive vs observe.
2. **`adapters/core.mdx`** — engine table rows + headless `createLayer` example.
3. **`guides/getting-started.mdx`** — keep `client.open`; add recommended `useLayer(options).open(payload)`.
4. **`guides/awaiting-results.mdx`** — idiomatic await via wired handle.
5. **`guides/serial-queues.mdx`** — `cancelQueued` FIFO vs `{ id }`; mention observe queued hooks.
6. **`guides/payload-validation.mdx`** — `ValidatedLayerHandle` / wired `validate`.
7. **`concepts/identity-and-types.mdx`** — handle path + `find` topmost note.
8. Optional polish: `blockers.mdx` / `dismissal-blockers.mdx` `cancelQueued` `{ id }` one-liners; HeroDemo cancel with `{ id: state.id }` when targeting a specific queued row.

### TypeDoc / generated API (REGEN)

- Regenerate after merge: root TypeDoc → `apps/docs/content/reference/api/**` (gitignored) via existing `docs:api` / rewrite-api-links pipeline.
- `<AutoTypeTable>` blocks pick up new exports from source — no hand-edit of generated trees.

---

## Phase D — README / skill consistency check

After Phase A manual merges, spot-check:

- Every package README taste uses PR #4 drive API, still points at Blume `## Docs`.
- Skills match adapter pages (no leftover positional `useLayer(key)`).
- Root README Concepts bullets mention handles without re-hosting the full API.

---

## Risk register

| Risk                                                            | Mitigation                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Prefer-branch on READMEs → PR #4 API vanishes from npm landings | Keep slim READMEs but update taste; put full API on Blume (Phase B–C) |
| Prefer-main on READMEs → lose Blume funnel / logo / Docs links  | Always keep branch landing shell                                      |
| Merge green but site still teaches old `useLayer`               | Do not open/merge docs PR until Phase B gate passes                   |
| `migration.mdx` still says “no migrations”                      | Phase B4 — first real entry                                           |
| Untracked modal-overlay research accidentally staged            | Explicitly omit; never `git add docs/research/` for this file         |
| Blume cache masks TypeDoc/API pages                             | `rm -rf .blume .blume-verify` before trusting build (lessons)         |

---

## Recommended commit shape (after this plan is approved)

1. **Merge commit** — `git merge origin/main` + Phase A resolutions only (source + conflict docs/skills/READMEs/architecture/glossary/roadmap).
2. **Docs adopt PR #4** — Phase B (+ C if ready) on `apps/docs` so the public site matches `0cd5770`.
3. Optional third slice — P1 polish / island `{ id }` cancels / regen API only if B is already large.

Do **not** commit `docs/research/modal-overlay-landscape-centralized.md`.

---

## Done when

- [ ] `docs/blume-docs-plan` contains `origin/main` (merge commit reachable)
- [ ] All 18 conflicts resolved per Phase A rules
- [ ] `bun run --filter ./packages/core test` (and adapter suites as needed) green
- [ ] `apps/docs` `typecheck:recipes` green
- [ ] `migration.mdx` documents the PR #4 observe/drive reshape
- [ ] Adapter + adapter-hooks pages match wired-handle API
- [ ] Glossary + core-api teach `createLayer` / cancelQueued `{ id }` / find topmost
- [ ] Modal-overlay research file still untracked and untouched
- [ ] Push branch; docs PR (if open) updated against main

## Closing this plan

When Phases A–C ship: lift any durable sync lessons into `docs/architecture.md` or skills if needed; **delete this plan** (docs-governance default — delete + lift).
)
