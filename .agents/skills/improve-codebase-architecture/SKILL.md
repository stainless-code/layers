---
name: improve-codebase-architecture
description: Architectural exploration — seam decisions, core/adapter isolation, zero-dep core gate. Plan under docs/plans/. Use when improving architecture, consolidating modules, or enforcing import boundaries.
---

# Improve Codebase Architecture

Always-on priming: [`architecture-priming`](../../rules/architecture-priming.md).

**This repo** uses plan files under `docs/plans/` instead of temp reports; vocabulary in [LANGUAGE.md](./LANGUAGE.md) is the architecture nouns. Domain terms: [`docs/glossary.md`](../../../docs/glossary.md) (layer/stack language: layer, stack, client, phase, call context, scope, gcTime, upsert, outlet).

Explore a slice of the codebase (a seam, an entry point, a module cluster) like an AI would, surface architectural friction, discover opportunities for improving testability and module boundaries, and propose deepening / boundary-enforcement refactors as **plan files** under `docs/plans/` (see Step 7).

Deep vs shallow modules: [`LANGUAGE.md`](./LANGUAGE.md) § Depth.

## Architecture vocabulary — read first

Use the terms in [LANGUAGE.md](./LANGUAGE.md) **exactly** in every suggestion this skill produces — module, interface, implementation, depth, seam, adapter, leverage, locality, deletion test. Consistent vocabulary is what stops a deepening conversation from drifting into "component / service / boundary" mush. Pass the vocabulary to every sub-agent spawned in Step 5 alongside the technical brief so designs come back named consistently.

The vocabulary is **separate from domain glossaries** — `LANGUAGE.md` covers architecture nouns (`module`, `seam`); [`docs/glossary.md`](../../../docs/glossary.md) holds canonical layer/stack nouns (`layer`, `stack`, `client`, `phase`, `call context`, `scope`, `gcTime`, `outlet`). All belong in the same conversation.

## Process

### 1. Explore the slice

Use a **read-only explore subagent** to navigate the slice naturally. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small files?
- Where are modules so shallow that the interface is nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called?
- Where do tightly-coupled modules create integration risk in the seams between them?
- Which parts are untested, or hard to test (DOM-coupled when they could be `bun:test`-fast)?
- Where does a framework adapter reach across the package seam — importing another adapter package's internals, or pulling a second framework peer into its entry?
- Where does `packages/core/src/` lack a public-surface convention — internal helpers exported from `packages/core/src/index.ts` alongside the public API?
- Where is the **zero-dep core gate** at risk — a new import in `packages/core/src/` pulling a framework peer value (`react`, `svelte`, `vue`, `solid-js`, `preact`, `@angular/core`)?

The friction you encounter IS the signal.

**Done when:** ≥3 candidates listed with cluster + dependency category.

### 2. Present candidates

Present a numbered list of opportunities. For each candidate, show:

- **Cluster**: which modules / entry points / seams are involved.
- **Why they're coupled**: shared types, call patterns, co-ownership of a concept, seam-crossing imports.
- **Dependency category**: see [REFERENCE.md](./REFERENCE.md) ("Dependency Categories"). Common cases in this repo: category 1 (in-process pure functions — most of `packages/core/src/`: the phase machine, scope queue, gcTime cache, batched notify); category 2 (local-substitutable — framework module stubs in adapter tests, a real `LayerClient` standing in for a wired app).
- **Test impact**: what existing `bun:test` / `packages/*/tests-dom/` coverage would be replaced by boundary tests; whether a new architectural regression test for the package boundary should land alongside.
- **Boundary enforcement option**: when relevant, the oxlint rule that would codify it — see [REFERENCE.md § Boundary enforcement](./REFERENCE.md#boundary-enforcement-oxlint) (this repo uses oxlint only; do not propose `eslint-plugin-boundaries`).

Don't propose interfaces yet. Ask the user: "Which of these would you like to explore?"

**Done when:** numbered candidate list presented (each with cluster, coupling, dependency category, test impact, boundary option); user asked to pick.

### 3. User picks a candidate

**Done when:** the user named one candidate by number.

### 4. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface / boundary rule would need to satisfy (existing import sites, the test surface, the published `.d.mts` public API, `docs/architecture.md` seam model).
- The dependencies it would need to rely on (`LayerStack`'s `subscribe`/`getSnapshot` contract, `LayerCallContext`, the `LayerPhase` lifecycle, the [`docs/glossary.md`](../../../docs/glossary.md) ubiquitous language).
- A rough illustrative code sketch to make the constraints concrete — this is **not** a proposal, just a way to ground the constraints.

Show this to the user, then immediately proceed to Step 5. The user reads and thinks about the problem while the sub-agents work in parallel.

**Done when:** problem-space explanation written and shown (constraints, dependencies, rough sketch); no interface proposed yet.

### 5. Design multiple interfaces (or boundary structures)

Spawn 3+ subagents in parallel (`generalPurpose` is usually right; `explore` if read-only). Each must produce a **radically different** design.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category, what's being hidden / enforced). This brief is independent of the user-facing explanation in Step 4. Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1–3 entry points max."
- Agent 2: "Maximize flexibility — support many use cases and extension (new framework adapters, new layer options)."
- Agent 3: "Optimize for the most common caller — make the default case trivial (one-line `client.open({ ...layerOptions, payload })`)."
- Agent 4 (when applicable): "Design around the ports & adapters pattern for a cross-boundary dependency (a new framework adapter that owns its renderer/transport)."
- Agent 4 alternate (boundary-enforcement candidate): design package-manifest and/or oxlint enforcement plus the post-refactor `packages/*/src/` shape per [REFERENCE.md § Boundary enforcement](./REFERENCE.md#boundary-enforcement-oxlint).

Each sub-agent outputs:

1. Interface signature (types, methods, params) — or, for boundary candidates, the lint config + the post-refactor folder shape.
2. Usage example showing how callers use it.
3. What complexity it hides internally — or, for boundary candidates, which classes of import become impossible.
4. Dependency strategy (how deps are handled — see [REFERENCE.md](./REFERENCE.md)).
5. Trade-offs.

Present designs sequentially, then compare them in prose (need ≥3 sub-agent outputs before comparing).

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not just a menu.

**Done when:** ≥3 sub-agent designs presented sequentially, compared in prose, and a recommendation (or hybrid) stated.

### 6. User picks an interface (or accepts recommendation)

If the choice between candidates is non-obvious — multiple designs survive the comparison, the user keeps asking "but what about X?", or the dependency graph between decisions isn't clear — drop into [`grill-with-docs`](../grill-with-docs/SKILL.md) before writing the plan. The grilling loop walks the decision tree branch-by-branch, surfaces hidden constraints, and writes resolved terminology back into [`docs/glossary.md`](../../../docs/glossary.md) inline. The plan file in Step 7 then captures decisions instead of options.

The deletion test (per [LANGUAGE.md § Principles](./LANGUAGE.md#principles)) is also worth re-running here: for each candidate, ask "if we deleted the new module 18 months from now, would the complexity it hides reappear across N callers, or just move?" If "just move", the deepening is a wash and you should pick a different candidate.

**Done when:** the user picked an interface (or accepted the recommendation); if the choice was non-obvious, a [`grill-with-docs`](../grill-with-docs/SKILL.md) loop walked the decision tree to resolution.

### 7. Create a plan file

The output of this skill is a **plan file** under `docs/plans/`. Pick the path based on what the refactor touches:

- **Cross-cutting / any refactor**: use the repository-level plan surface at `docs/plans/<short-kebab-name>.md` with the template in [REFERENCE.md](./REFERENCE.md).
- **Roadmap entry**: one line under the appropriate section in [`docs/roadmap.md`](../../../docs/roadmap.md).

Write the plan, then share the file path(s) and any roadmap-link paths so the user can open them. Don't ask for review before writing.

**Done when:** plan file at path; roadmap link.

If the user explicitly asks for a GitHub issue, draft the issue body but do **not** create it directly — the user files it themselves.

**Plan-file conventions:** [REFERENCE.md § Project-specific conventions](./REFERENCE.md#project-specific-conventions).
