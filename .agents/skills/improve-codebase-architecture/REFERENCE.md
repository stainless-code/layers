# Reference

> **See also [LANGUAGE.md](./LANGUAGE.md)** for the vocabulary every recommendation uses (module, interface, depth, seam, adapter, leverage, locality, deletion test). Read it before applying the dependency categories below — the categories assume the vocabulary.

## Dependency Categories

When assessing a candidate for deepening, classify its dependencies:

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — just merge the modules and test directly.

> **Examples in this repo.** Most of `packages/core/src/`: the phase machine (`LayerStack.#commit`/`#runLoad`/`#remove`), the scope serial queue, the gcTime cache, `notifyManager.batch`, `Subscribable`, `ControlledPromise`, `hashKey`. `packages/core/src/callContext.ts` (the imperative `call` handle).

### 2. Local-substitutable

Dependencies that have local test stand-ins. Deepenable if the test substitute exists. The deepened module is tested with the local stand-in running in the test suite.

> **Examples in this repo.** A framework-module stub doubles for `solid-js` / `@angular/core` / `preact/compat` in `bun:test` (no DOM, no real renderer). A real `LayerClient` + `LayerStack` exercises the whole engine with no framework at all — `packages/core/src/layerStack.test.ts` runs without React/Svelte/Vue/Solid/Preact/Angular. The `LayerStack` `subscribe`/`getSnapshot` contract is observed from outside any framework, so adapter tests stub or scope the framework module and assert the binding, while `packages/*/tests-dom/` covers each adapter's real-renderer path separately.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (a future remote layer host, a synced stack). Define a port (interface) at the module boundary. The deep module owns the logic; the transport is injected. Tests use an in-memory adapter. Production uses the real adapter.

> **Examples in this repo.** Today every framework adapter is local, so category 3 is mostly forward-looking — the `LayerStack` `subscribe`/`getSnapshot` contract is the port a future host/portal adapter would satisfy. The core/adapter seam already isolates the engine, so a new host composes without core changes.

### 4. True external (Mock)

Third-party packages you don't control (`react`, `svelte`, `vue`, `solid-js`, `preact`, `@angular/core`). Mock at the boundary. The deepened module takes the external dependency as an injected port, and tests provide a mock / stand-in.

> **Examples in this repo.** Each framework adapter has a `packages/<fw>/src/` binding tested under `bun:test` (framework module stubbed or scoped) and, where applicable, a `packages/<fw>/tests-dom/` suite with a real renderer (React `@testing-library/react`, Vue `@testing-library/vue`, Solid `@solidjs/testing-library`, Angular TestBed, Svelte `@testing-library/svelte`, etc.). Core tests use no framework at all.

## Seam discipline

Distilled in [LANGUAGE.md § Principles](./LANGUAGE.md#principles) — one-adapter-vs-two, internal vs external seams, replace-don't-layer. Apply those here.

## Testing Strategy

**Replace, don't layer** — old unit tests on shallow modules are waste once boundary tests exist; write new tests at the deepened module's interface boundary; assert observable outcomes through the public interface; tests survive internal refactors. Test shapes: [`tdd/PATTERNS.md`](../tdd/PATTERNS.md).

For boundary-enforcement candidates, add one architectural regression test only when the package manifest, `sherif`, `knip`, and oxlint cannot enforce the rule directly. This repo does not currently have a dedicated zero-dep-core static-scan test.

## Boundary enforcement (oxlint)

This repo runs **oxlint only** (no ESLint, no `eslint-plugin-boundaries`). The primary seam is the published package boundary: `packages/core` has no dependencies, while each `packages/<fw>` manifest declares only `@stainless-code/layers` plus its framework peer; root `check:deps` runs `sherif`, and `knip.json` configures every workspace. Use oxlint only for import restrictions that package manifests cannot express.

- **`eslint/no-restricted-imports`** — directional rules. Use it to forbid imports from another workspace's `src/` internals or framework peers in `packages/core/src/`. Prefer public package imports; do not create type-only cross-adapter escape hatches.
- **`import/no-cycle`** — runs under oxlint's multi-file analysis. One config flip; no extra deps.
- **`oxc/no-barrel-file`** — consider only for internal folders. Each package intentionally has a public `src/index.ts` or `src/index.tsx` entry, so this rule cannot be enabled indiscriminately.

### Nested-config rules (read before adding a new one)

oxlint resolves the **nearest** `.oxlintrc.json` for each file and **does not auto-merge with parents**. That has three concrete consequences:

1. **Always set `extends`.** Every nested config must extend a parent config that ultimately reaches the repo-root `.oxlintrc.json`, otherwise baseline plugins/rules silently disappear for the files it owns.
2. **The `!` negation in `files` does not work** in oxlint. A `files: ["**", "!packages/react/src/**"]` override still matches React source files, which can silently shadow a more specific rule.
3. **Same rule key in two `overrides[]` matching the same file → later replaces earlier.** Patterns do not merge across overrides. Combine all applicable patterns into a single `no-restricted-imports` rule per scope.

Because of (2) and (3), the cleanest pattern is **one config file per scope** — the repo-root config plus a deeper config for a package that needs different rules. Each leaf `extends` its parent and re-declares any rules it wants to carry alongside its own.

Canonical example layout (if the core package needs a stricter import rule):

```text
.oxlintrc.json                    ← baseline
packages/core/.oxlintrc.json      ← extends root, core zero-dep value-import ban
```

Example leaf for a directional rule (keep `packages/core/src/` free of framework-peer imports — the zero-dep gate):

```json
{
  "$schema": "../../node_modules/oxlint/configuration_schema.json",
  "extends": ["../../.oxlintrc.json"],
  "rules": {
    "eslint/no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": [
              "react",
              "preact",
              "svelte",
              "vue",
              "solid-js",
              "@angular/core"
            ],
            "message": "Zero-dep core: framework peers belong in their adapter packages."
          }
        ]
      }
    ]
  }
}
```

Public-surface rule: each package exports its own public API from `packages/<name>/src/index.*`; internal helpers stay unexported. Package manifests expose `.` (plus Svelte's deliberate `./store`) and `./package.json`. Do not apply `oxc/no-barrel-file` to these intentional public entries.

## Plan Template

Plan files live at `docs/plans/<short-kebab-name>.md`. Use this template:

```md
# <Plan title>

> Plan owner: <name or "open">. Status: **Draft / In progress / Landed**. Link from `docs/roadmap.md`.

## Problem

Describe the architectural friction:

- Which modules are shallow / which seam is currently unenforced.
- What integration risk exists in the seams between them.
- Why this makes the codebase harder to navigate, modify, or test.
- (If applicable) the inline `NOTE(...)` markers in source that point here.

## Proposed Interface (or Boundary)

The chosen design from Step 5–6 of the skill:

- Interface signature (types, methods, params), or the post-refactor `packages/*/src/` shape + the manifest/lint config that enforces it.
- Usage example showing how callers use it.
- What complexity / which import classes it hides / forbids.

## Dependency Strategy

Which category from `REFERENCE.md` applies and how dependencies are handled:

- **In-process**: merged directly.
- **Local-substitutable**: tested with [specific stand-in] (framework module stub, real `LayerClient`).
- **Ports & adapters**: port definition, production adapter, test adapter.
- **Mock**: mock boundary for external framework peers (`react`, `svelte`, `vue`, `solid-js`, `preact`, `@angular/core`).

## Migration

- **Import sites to update**: enumerate (Grep result), don't guess.
- **Backwards-compatible re-exports** (if any) and the deprecation window (changeset entry).
- **Order of operations**: the smallest landing-safe slices (tracer bullets).

## Testing Strategy

- **New boundary tests to write**: describe the behaviours to verify at the interface.
- **Architectural regression test** (if a boundary candidate): any gate not already covered by package manifests, `sherif`, `knip`, or oxlint.
- **Old tests to delete**: list shallow-module tests that become redundant after the refactor.
- **Test environment needs**: any local stand-ins or adapters required (which runner — `bun:test` vs `packages/<fw>/tests-dom/`).

## Glossary impact

- Terms in [`docs/glossary.md`](../../../docs/glossary.md) that get renamed, added, or have their canonical name changed by this plan. Update glossary on the same PR. If the term is genuinely domain-bearing and there's no glossary entry yet, recommend [`domain-modeling`](../domain-modeling/SKILL.md) first.

## Out of scope

- Things that look related but explicitly aren't part of this plan (so reviewers don't expect them).

## Open questions

- Anything the plan author needs a maintainer / domain expert to answer before / during execution.
```

## Project-specific conventions

- **File naming**: don't add a `-plan` suffix — the `plans/` folder provides context. `docs/plans/<short-kebab-name>.md`.
- **Roadmap link format**: `[<title>](./plans/<file>.md)` under the appropriate section in `docs/roadmap.md`.
- **Boundary candidates that need lint enforcement** should propose the exact `.oxlintrc.json` block in the same plan — see [Boundary enforcement](#boundary-enforcement-oxlint) above.
- **Public-surface changes**: when the candidate touches a package public API (an `exports` map entry, a shipped `.d.mts`, the root `README.md`), the plan must include the migration path for **every** consumer-reachable import (and a changeset entry). The published typings are the public surface — don't guess; enumerate via `packages/*/package.json` `exports` + the package's `src/index.*` exports.
- **Pure dead-code removal is not a plan candidate.** Those go directly into `docs/roadmap.md`. This skill is for plans that need design discussion.
- **Glossary cross-reference**: when the proposal renames or introduces a domain term, link to (and on the same PR, update) [`docs/glossary.md`](../../../docs/glossary.md). If there's no entry yet and the term is genuinely domain-bearing, recommend [`domain-modeling`](../domain-modeling/SKILL.md) first.
