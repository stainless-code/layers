# Batch glossary scan

Full terminology extraction to [`docs/glossary.md`](../../../docs/glossary.md). For **inline** term pinning during grilling or implementation, use the main [`domain-modeling`](./SKILL.md) session flow — not this file.

## Process

1. **Scan the slice** for domain-relevant nouns, verbs, and concepts. Look at: the core/adapter seam (`LayerStack` `subscribe`/`getSnapshot`, `Layer`, `LayerClient`); the layer lifecycle (`LayerPhase`: `pending`/`queued`/`active`/`dismissed`/`error`, `LayerTransition`: `entering`/`settled`/`exiting`, `LayerActionStatus`, `LayerState.dismissing`); the call context (`LayerCallContext`: `end`/`dismiss` (async `Promise<boolean>`)/`addBlocker`/`update`/`setRunning`/`settle`/`ended`/`index`/`stackSize`/`root`/`stackId`/`layerId`); blockers (`addBlocker`, `DismissAllMode`, `dismissAll` modes); package entry points and optional peers (`packages/*/package.json` `exports` — core `@stainless-code/layers`, separate `@stainless-code/<fw>-layers` package roots, plus Svelte's `./store` entry); option names (`upsert`, `enteringDelay`, `exitingDelay`, `loadFn`, `validate`, `scope`, `gcTime`, `rootProps`, `StackOptions.dismissAllMode`); framework adapter names; JSDoc that hints at semantics.
2. **Identify problems**:
   - Same word used for different concepts (ambiguity — e.g. "stack" for both `LayerStack` and the call stack; "layer" for both the frame and the rendering component).
   - Different words used for the same concept (synonyms — e.g. "dismiss" vs "close" vs "end").
   - Vague or overloaded terms (e.g. "the response" vs `R`).
   - An option or phase name bleeding into prose without a domain explanation.
3. **Propose a canonical glossary** with opinionated term choices.
4. **Write to `docs/glossary.md`** following the format in [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md). Link from [`docs/README.md`](../../../docs/README.md) § Reference.
5. **Output a summary** inline in the conversation.

**Done when:** every domain term surfaced by the scan is in `docs/glossary.md` (grouped, opinionated, cite-by-path), linked from the docs README § Reference, with ambiguities flagged and an inline summary posted.

## Output format

Write the glossary file per [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md). **Group naturally** — by seam, lifecycle, or concern. Don't force groupings if one table is cohesive enough.

```md
# Layers — Ubiquitous Language

> Single canonical glossary for terms used across `packages/*/src/` and `docs/`.
> When in doubt, this file wins. Update on the same PR that introduces a new term.

## Core / adapter

| Term | Definition | Aliases / avoid |

## Lifecycle

| Term | Definition | Aliases / avoid |

## Flagged ambiguities

- "<term>" was used to mean both **<canonical-A>** and **<canonical-B>**. Recommendation: ...
```

### Groupings (illustrative)

- **Core / adapter**: `LayerClient`, `LayerStack`, `Layer`, `createCallContext`, `layerOptions`, `layerKey`, `createLayerGroup`, the core/adapter seam.
- **Lifecycle**: `LayerPhase` (`pending`/`queued`/`active`/`dismissed`/`error`), `LayerTransition` (`entering`/`settled`/`exiting`), `LayerActionStatus`, `LayerState.dismissing`, `open`, `dismiss`/`end` (`{ force }`), `addBlocker`, `dismissAll` (`DismissAllMode`), `ended`, `settle`.
- **Options / behavior**: `upsert`, `update`, `enteringDelay`, `exitingDelay`, `loadFn` + `AbortController`, `validate`, `scope` (serial/parallel), `gcTime`, `rootProps`, `StackOptions.dismissAllMode`.
- **Binding**: `useStack`, `useStackHandles`, `useLayerGroup`, `createStackHook`, `useMutationFlow`, `StackOutlet`, `StackProvider`, `StackSubscribe`, observer/selector.
- **Entry points**: subpath entry, optional peer, zero-dep core, no-barrel.

## Rules

Per [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md) § Rules — opinionated, tight, domain-only, cite-by-path. Flag conflicts in § Flagged ambiguities.

## Re-running

When invoked again on a previously-glossarised repo:

1. Read the existing `docs/glossary.md`.
2. Incorporate new terms surfaced by recent PRs.
3. Update definitions if understanding has evolved.
4. Re-flag any new ambiguities.

## Project conventions

File location and cross-reference home: see [GLOSSARY-ENTRY.md](./GLOSSARY-ENTRY.md) § Where vocabulary lives.
