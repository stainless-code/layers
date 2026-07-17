# Devtools + `#dispatch` (TanStack shell)

> Plan owner: open. Status: **Ready** (grilled). Linked from [`docs/roadmap.md`](../roadmap.md) Robustness.

## Problem

`LayerStack` mutations only unify at `#flush` → `Subscribable.notify`. That answers “did the snapshot change?” — not _which_ transition ran. Without a transition choke point, a stack inspector can only poll snapshots, and a `StackNotifyEvent` stream cannot be honest.

## Decisions (locked)

| Topic              | Decision                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Timing             | Build now on 0.2.x (experimental; schema may churn)                                                                                                          |
| Shell              | TanStack Devtools unified shell ([docs](https://tanstack.com/devtools/latest)); Pacer/a11y = cookbook                                                        |
| Packages           | **3 involved, 2 new:** `@stainless-code/layers` (exists) · `@stainless-code/layers-devtools` · `@stainless-code/react-layers-devtools`. No `./react` subpath |
| Event ownership    | **Core** owns `StackNotifyEvent` types + emit; **devtools** owns EventClient bridge + Solid panel                                                            |
| Zero-dep           | Path **B** — no `@tanstack/*` in core; `LayerClient#subscribeNotify`                                                                                         |
| `#dispatch`        | Thin choke point (label + existing mutators + `#flush`); not a pure reducer rewrite                                                                          |
| Emit gate          | Only when `#flush` changes snapshot/queued refs; plus stack `register`; action label from causing `#dispatch`                                                |
| Panel UI           | Solid core in `layers-devtools` (`constructCoreClass`); thin React doorbell                                                                                  |
| EventClient        | Regular **dependency** of `layers-devtools` (`pluginId: 'layers'`, `reconnectEveryMs: 1000`)                                                                 |
| Wire shape         | `stackId`, `seq`, `ts`, coarse `action`, `active`/`queued` projections, JSON-safe `payload` + `payloadTruncated`                                             |
| Actions (live-ref) | Soft dismiss · cancel queued · force dismiss (confirm) · `dismissAll` (all modes). No bus command protocol                                                   |
| Mount              | Auto-attach from `StackProvider` context; `{ client }` override                                                                                              |
| Deferred           | Other framework doorbells · bus bidirectional · time-travel · fine `dismiss-begin`/`vetoed` labels · marketplace PR                                          |

### Rejected alternatives

| Rejected                                                      | Why                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| EventClient inside `@stainless-code/layers` (Pacer-identical) | Breaks zero-dep / tenet 1; B keeps hallway door                    |
| One package + `./react` subpath                               | TanStack ships separate `*-devtools` + `react-*-devtools` packages |
| Full reducer / `DispatchMutable` in v1                        | Over-rewrite; TanStack instruments method edges                    |
| Emit on every `#dispatch` including no-op `#flush`            | Spam; diverge from adapter snapshot identity                       |
| Bus-bidirectional commands                                    | Live `LayerClient` in doorbell is enough for v1 actions            |

## Proposed interface

### Core (`@stainless-code/layers`)

```ts
type StackNotifyAction =
  | "register"
  | "open"
  | "queue"
  | "update"
  | "setRunning"
  | "settle"
  | "dismiss"
  | "dismissAll"
  | "cancelQueued"
  | "phase"
  | "remove";

interface LayerNotifyView {
  id: string;
  key: string; // display / keySignature string
  phase: LayerPhase;
  transition: LayerTransition;
  actionStatus: LayerActionStatus;
  dismissing: boolean;
  ended: boolean;
  index: number;
  stackSize: number;
  payload?: unknown; // JSON-safe
  payloadTruncated?: boolean;
}

interface StackNotifyEvent {
  stackId: string;
  seq: number;
  ts: number;
  action: StackNotifyAction;
  active: LayerNotifyView[];
  queued: LayerNotifyView[];
}

// LayerClient
subscribeNotify(listener: (event: StackNotifyEvent) => void): () => void;
```

Internal: `#dispatch(action)` → existing commit paths → `#flush` → if refs changed, fan out `subscribeNotify` (client aggregates per-stack).

### `layers-devtools`

- `attachLayerDevtools(client)` → `subscribeNotify` + `subscribeStacks` → `EventClient.emit('stack-state' | 'stack-registry', …)`
- Solid panel: stack picker, active/queued table, payload JSON, action log column, live-ref buttons
- Deps: `@stainless-code/layers`, `@tanstack/devtools-event-client`, Solid + `@tanstack/devtools-utils` / `devtools-ui` as needed

### `react-layers-devtools`

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { layersDevtoolsPlugin } from "@stainless-code/react-layers-devtools";

<StackProvider>
  <App />
  {import.meta.env.DEV && (
    <TanStackDevtools plugins={[layersDevtoolsPlugin()]} />
  )}
</StackProvider>;
```

Peers: `react`, `@stainless-code/react-layers`, `@tanstack/react-devtools`, `@tanstack/devtools-utils`. Pacer-style NoOp / `./production` tuple.

## Dependency strategy

| Package                 | Deps                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| core                    | none (in-process `#dispatch` + listener Set)                     |
| `layers-devtools`       | layers; **dep** `devtools-event-client`; Solid / utils for panel |
| `react-layers-devtools` | `layers-devtools`; peers React + TanStack React Devtools         |

## Tracer-bullet order

1. Core: thin `#dispatch` on `open` + dismiss-commit + `#flush` gate + `subscribeNotify` test
2. Frame v1: remaining mutation paths + JSON-safe views + `register`
3. `layers-devtools`: attach + EventClient + Solid read-only table
4. `react-layers-devtools`: plugin + context attach
5. Live-ref actions: dismiss / cancelQueued / force+confirm / dismissAll modes
6. Docs recipe + changeset

## Testing strategy

- Core: every public mutation that changes snapshots emits once with expected `action`; no-op `#flush` silent; `notifyManager.batch` unchanged for `subscribe`
- Devtools: map/attach unit tests; JSON-safe payload cases (`payloadTruncated`)
- React DOM: plugin inside `StackProvider`; table updates after `open`; dismiss button closes layer

## Glossary impact

Added: **StackNotifyEvent**, **subscribeNotify**, **#dispatch** (concept). See [`docs/glossary.md`](../glossary.md).

## Out of scope

- SSR / `initialSnapshot`, Thenable `.status`, `setOptions`
- HostAdapter / portal / z-order
- Vue/Solid/… doorbell packages (later)
- Bus-bidirectional / time-travel / open-from-panel / blocker inspector

## Open questions

None blocking. Deferred product follow-ups stay in roadmap backlog when surfaced.
