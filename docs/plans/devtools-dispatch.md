# Devtools + `#dispatch` (TanStack shell)

> Plan owner: open. Status: **In progress** (slices 1–5 in tree). Linked from [`docs/roadmap.md`](../roadmap.md) Robustness.

## Problem

`LayerStack` mutations only unify at `#flush` → `Subscribable.notify`. That answers “did the snapshot change?” — not _which_ transition ran. Without a transition choke point, a stack inspector can only poll snapshots, and a `StackNotifyEvent` stream cannot be honest.

## Decisions (locked)

| Topic              | Decision                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing             | Build now on 0.2.x (experimental; schema may churn)                                                                                                 |
| Shell              | TanStack Devtools unified shell ([docs](https://tanstack.com/devtools/latest)); Pacer/a11y = cookbook                                               |
| Packages           | **3 involved, 2 new:** `@stainless-code/layers` · `@stainless-code/layers-devtools` · `@stainless-code/react-layers-devtools`. No `./react` subpath |
| Folders            | `packages/devtools` + `packages/react-devtools` (short folders; long npm names)                                                                     |
| Event ownership    | **Core** owns `StackNotifyEvent` types + emit; **devtools** owns EventClient bridge + Solid panel                                                   |
| Zero-dep           | Path **B** — no `@tanstack/*` in core; `LayerClient#subscribeNotify`                                                                                |
| `#dispatch`        | Thin choke point (label + existing mutators + `#flush`); not a pure reducer rewrite                                                                 |
| Emit gate          | Only when `#flush` changes snapshot/queued refs; plus stack `register`; action label from causing `#dispatch`                                       |
| Panel UI           | Solid core in `layers-devtools` (`constructCoreClass`); thin React doorbell                                                                         |
| EventClient        | Regular **dependency** of `layers-devtools` (`pluginId: 'layers'`, `reconnectEveryMs: 1000`)                                                        |
| Wire shape         | `stackId`, `seq`, `ts`, coarse `action`, `active`/`queued` projections, JSON-safe `payload` + `payloadTruncated`                                    |
| Actions (live-ref) | Soft dismiss · cancel queued · force dismiss (confirm) · `dismissAll` (all modes). No bus command protocol                                          |
| Mount              | Auto-attach from `StackProvider` context; `{ client }` override                                                                                     |
| Deferred           | Other framework doorbells · bus bidirectional · time-travel · fine `dismiss-begin`/`vetoed` labels · marketplace PR                                 |

### Rejected alternatives

| Rejected                                                      | Why                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| EventClient inside `@stainless-code/layers` (Pacer-identical) | Breaks zero-dep / tenet 1; B keeps hallway door                    |
| One package + `./react` subpath                               | TanStack ships separate `*-devtools` + `react-*-devtools` packages |
| Full reducer / `DispatchMutable` in v1                        | Over-rewrite; TanStack instruments method edges                    |
| Emit on every `#dispatch` including no-op `#flush`            | Spam; diverge from adapter snapshot identity                       |
| Bus-bidirectional commands                                    | Live `LayerClient` in doorbell is enough for v1 actions            |

## Shipped surface (source of truth)

- Core: `StackNotifyAction` / `LayerNotifyView` / `StackNotifyEvent` in `packages/core/src/types.ts`; `LayerClient#subscribeNotify` + `seedNotify`; stack `#dispatch` → `#flush` gate
- `layers-devtools`: `attachLayerDevtools` → EventClient (`stack-state` / `stack-registry`) + Solid panel + live-ref actions
- `react-layers-devtools`: `layersDevtoolsPlugin` + NoOp / `./production`; auto-attach under `StackProvider`

Site recipe: `/guides/devtools`.

## Testing

- Core: mutations that change snapshots emit once with expected `action`; no-op `#flush` silent; `notifyManager.batch` unchanged for `subscribe`
- Devtools: attach + live-actions unit tests; JSON-safe `payloadTruncated`
- Deferred: React DOM harness for panel buttons

## Glossary impact

**StackNotifyEvent**, **subscribeNotify**, **#dispatch** — [`docs/glossary.md`](../glossary.md).

## Out of scope

- SSR / `initialSnapshot`, Thenable `.status`, `setOptions`
- HostAdapter / portal / z-order
- Vue/Solid/… doorbell packages (later)
- Bus-bidirectional / time-travel / open-from-panel / blocker inspector

## Open questions

None blocking. Deferred product follow-ups stay in roadmap backlog when surfaced.
