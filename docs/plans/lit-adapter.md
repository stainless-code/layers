# Lit adapter (`@stainless-code/lit-layers`)

> Plan owner: open. Status: **Implementation complete** on `feat/lit-adapter` — full matrix + tests + docs landed; pending PR merge. Open questions cleared. Linked from [`docs/roadmap.md`](../roadmap.md) § Adapters. Delete + lift into [`architecture.md`](../architecture.md) only after the PR ships.

Seventh framework adapter at **full matrix parity**. Lit research clone: `/Users/sutusebastian/Developer/OSS/lit/lit` ([lit/lit](https://github.com/lit/lit), [`lit@3.3.3`](https://lit.dev/)).

## Problem

- Six adapters at parity; Lit/WC consumers need the same binding **Seam** (`LayerStack.subscribe` / `getSnapshot` → host reactivity + render).
- Lit idioms differ ([Reactive Controllers](https://lit.dev/docs/composition/controllers/), [`@lit/context`](https://lit.dev/docs/data/context/), [`repeat`](https://lit.dev/docs/templates/lists/)) — shape must be Lit-native while hitting every matrix cell.
- Default Lit shadow DOM fights overlays; no `HostAdapter` (roadmap) — outlet must render inline where mounted.
- Policy: **every new adapter gets full treatment** (primitives + tier-2 sugar, `tests-dom`, docs, skill, recipes typecheck, size-limit) — not a sparse MVP.

## Decisions (grilled)

| Topic               | Lock                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When                | Consumers in funnel — implement after this plan; no demand-wait                                                                                                 |
| Parity bar          | Full matrix like React/Vue/Solid (capability), Lit-shaped APIs                                                                                                  |
| Binding model       | `ReactiveController` + `requestUpdate`; CEs for provider/outlet/subscribe                                                                                       |
| Factory             | `createStackHook` name kept; Lit-shaped return                                                                                                                  |
| Outlet DOM          | **Light DOM default** (`createRenderRoot() { return this }`); optional shadow later only if needed                                                              |
| `component`         | `(props) => TemplateResult` **or** `typeof LitElement`; **no** tag strings in v1                                                                                |
| CE tags             | `stack-provider` / `stack-outlet` / `stack-subscribe` (+ `app-host` for `createStackHook`) — kebab of matrix names                                              |
| CE registration     | Explicit **`defineStackElements()`** on `.`; **`"sideEffects": false`**; no auto-register on import (tenets 2 + 4)                                              |
| Peers               | `lit` `^3.2.0`, `@lit/context` `^1.1.0` (required); optional `client?` override everywhere                                                                      |
| Signals             | **Single flavour** now. `./signals` only if Lit promotes signals past Labs (same bar as Svelte runes vs `./store`)                                              |
| `StackSubscribe`    | Property **`.renderer`** callback ([virtualizer `.renderItem`](https://github.com/lit/lit/tree/main/packages/labs/virtualizer) pattern)                         |
| `LayerGroup`        | **`outlet(): TemplateResult` + `stackId`** ([router `Routes.outlet()`](https://github.com/lit/lit/tree/main/packages/labs/router); like Angular `renderInto`)   |
| `createStackHook`   | React-full: `StackProvider`, `useAppStack`, `AppHost` CE, `AppLayerController`                                                                                  |
| Observe/drive names | `*Controller` classes + thin `use*(host, …)` factories (matrix names)                                                                                           |
| SSR                 | Vue/Solid posture: subscribe in `hostConnected`, teardown `hostDisconnected`; empty until connect; no `typeof window` guard; `initialSnapshot` separate roadmap |
| `ContextRoot`       | Optional / documented for late-upgraded providers — **not** auto-installed                                                                                      |
| Docs recipes        | Lit = code-only tabs (`?raw`); Blume live `<Component>` hard-caps React/Vue/Svelte                                                                              |

## Proposed Interface (or Boundary)

### Package

| Item          | Value                                             |
| ------------- | ------------------------------------------------- |
| Path          | `packages/lit`                                    |
| Name          | `@stainless-code/lit-layers`                      |
| Dep           | `@stainless-code/layers` `workspace:*`            |
| Peers         | `lit` `^3.2.0`, `@lit/context` `^1.1.0`           |
| `sideEffects` | `false`                                           |
| Exports       | `.` only (no `./elements`, no `./signals`)        |
| Build         | `tsdown`; knip + size-limit + `check:pack` parity |

### Public surface

```ts
export * from "@stainless-code/layers";

// Context (@lit/context)
export const layerClientContext: Context<…, LayerClient>;
export function provideLayerClient(host, client?: LayerClient): LayerClient;
export function useLayerClient(host): LayerClient; // throws if missing

// Registration (idempotent customElements.define)
export function defineStackElements(): void;

// Controllers + use* factories (host-first) — full matrix:
// useStack, useQueuedStack, useLayerState, useLayerQueuedState,
// useLayer, useStackHandles, useMutationFlow, useLayerGroup, useLayerClient
export class StackController implements ReactiveController { /* … */ }
export class LayerController implements ReactiveController { /* wired handle */ }
export class StackHandlesController implements ReactiveController { /* … */ }
export class MutationFlowController implements ReactiveController { /* … */ }
export class LayerGroupController implements ReactiveController {
  outlet(): TemplateResult; // router-shaped
  readonly stackId: string;
  // open, dismissAll, states, …
}

// CEs (classes exported; define via defineStackElements)
export class StackProvider extends LitElement { /* tag: stack-provider */ }
export class StackOutlet extends LitElement {
  /* tag: stack-outlet; light DOM; repeat by state.id;
     component = TemplateResult fn | LitElement ctor */
}
export class StackSubscribe extends LitElement {
  /* tag: stack-subscribe; .selector; .renderer(value) => TemplateResult */
}

export function createStackHook(config?): {
  StackProvider: typeof StackProvider; // bound stack id / client defaults
  useAppStack: (host) => AppStackController;
  AppHost: typeof LitElement; // tag app-host — host props + stack-outlet
  AppLayer: typeof AppLayerController;
};

export type LitLayerComponent =
  | (new () => LitElement)
  | ((props: LayerComponentProps) => TemplateResult);
```

Internal: `subscribeStackSnapshot` (pull-model subscribe + selector memo + `requestUpdate`).

### Usage (default path)

```ts
import {
  LayerClient,
  createLayer,
  defineStackElements,
  provideLayerClient,
} from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

defineStackElements();

export const client = new LayerClient();
export const confirm = createLayer({
  key: "confirm",
  stack: "modal",
  component: ConfirmDialog, // LitElement ctor or (props) => TemplateResult
});

@customElement("my-app")
class MyApp extends LitElement {
  render() {
    return html`<button
      @click=${() => confirm(client).open({ message: "Delete?" })}
    >
      Delete
    </button>`;
  }
}

// shell
html`
  <stack-provider .client=${client}>
    <my-app></my-app>
    <div id="overlays"><stack-outlet stack="modal"></stack-outlet></div>
  </stack-provider>
`;
```

### What it hides / forbids

- Hides: subscribe lifecycle, selector memo, `createCallContext`, context wire-up.
- Forbids: cross-adapter imports; framework peers in core; `HostAdapter` / built-in portal; auto CE registration on `.` import; `@lit-labs/signals` in v1.

## Dependency Strategy

| Category                | How                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **Ports & adapters**    | Core port = `subscribe` / `getSnapshot` / `getQueuedSnapshot`. Lit owns Transport + Renderer.       |
| **Mock (cat. 4)**       | Peers `lit` + `@lit/context`. Never duplicate `lit`.                                                |
| **Local-substitutable** | Fake `ReactiveControllerHost` + real `LayerClient` in bun tests; vitest + real Lit in `tests-dom/`. |

## Migration

Greenfield.

1. Scaffold `packages/lit` (mirror Vue: manifest, tsdown, tsconfig, README, knip, size-limit).
2. Tracer: `subscribeStackSnapshot` + `StackController` / `useStack` + unit test.
3. Context + `provideLayerClient` / `useLayerClient`.
4. `defineStackElements` + `StackOutlet` / `StackProvider` + `tests-dom` (id-keyed `repeat`, light DOM).
5. Remaining matrix: wired `useLayer`, `StackSubscribe`, `useMutationFlow`, `useLayerGroup` (`outlet()`), `useStackHandles`, `createStackHook` + DOM/type tests.
6. Docs: `adapters/lit.mdx`, matrix rows, `adapter-hooks.mdx`, skill, recipes (`lit.ts` `?raw`) + `typecheck:recipes`.
7. Changeset on publish PR. Lift grill locks into [`architecture.md`](../architecture.md) when the package ships (close plan).

## Post-merge closeout

After the Lit PR merges (not before — don't advertise unreleased adapters):

1. **GitHub repo About** (Settings → General → Edit, or sidebar ✎):
   - **Description** (docs-voice adapter order: react → preact → solid → angular → vue → lit → svelte):

     > Headless manager for modal/dialog/drawer/popover/toast UI — open any layer from anywhere, manage it as an ordered named stack, and optionally await a typed result. UI-agnostic core + React/Preact/Solid/Angular/Vue/Lit/Svelte adapters.

   - **Website:** keep `https://stainless-code.com/layers`
   - **Topics:** add `lit` (keep existing: `react`, `preact`, `solid`, `angular`, `vue`, `svelte`, `typescript`, `state-management`, `stack`, `drawer`, `popover`, `headless`, `overlay`, `modal`, `dialog`, `toast`, `monorepo`).
2. Delete this plan; finish any remaining lift into [`architecture.md`](../architecture.md); drop Lit from “pending” in [`docs/roadmap.md`](../roadmap.md) (public roadmap already says shipping).

## Testing Strategy

| Suite           | Assert                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `src/*.test.ts` | Subscribe/unsub; selector skip; context; `defineStackElements` idempotent; group `outlet()`       |
| `tests-dom/`    | Provider → outlet → open/end; no remount on prop churn; light DOM; subscribe `.renderer`; AppHost |
| `*.test-d.ts`   | Inference parity                                                                                  |

## Glossary impact

None. Framework bindings (`StackController`, `outlet()`, CE tags) are not new domain nouns. Existing glossary (`outlet`, `observer`, `call context`, `useLayer`) stands.

## Out of scope

- `@lit-labs/signals` / `./signals` until Lit first-party signals (Svelte dual-API bar).
- `@lit-labs/ssr` package; tag-string `component`; auto-register on import; `HostAdapter` / portal; focus/z-order/a11y chrome.
- Lit 4 peer OR until Lit 4 exists.

## Rejected alternatives

| Alternative                            | Why rejected                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Sparse controllers-only v1             | Policy: full treatment for every new adapter                                       |
| Demand-gate before coding              | Consumers ready now                                                                |
| Auto-register CEs on `.` import        | Tenet 4 (surprising side effects); tenet 2 (outlet optional)                       |
| `./elements` side-effect subpath       | Same magic as auto-register; Svelte subpath is dual reactivity, not define helpers |
| `layers-*` / `sc-*` tags               | Drifts from `StackOutlet` naming on other adapters                                 |
| Shadow DOM outlet default              | Overlay stacking; consumers own portals                                            |
| Bound `Outlet` CE from `useLayerGroup` | Not Lit-native; use `outlet()` like router                                         |
| Signals dual entry now                 | Labs ≠ Svelte’s two first-party APIs                                               |

## Open questions

None blocking implementation. Deferred: Lit 4 peer OR; `mode="shadow"` on outlet; `./signals` if Labs graduates.

## References

- Layers: [`docs/architecture.md`](../architecture.md), [`adapter-hooks.mdx`](../../apps/docs/content/reference/adapter-hooks.mdx), Vue/Solid/Angular peers.
- Lit: [lit.dev](https://lit.dev/), [Controllers](https://lit.dev/docs/composition/controllers/), [Context](https://lit.dev/docs/data/context/), [`repeat`](https://lit.dev/docs/templates/lists/), clone `/Users/sutusebastian/Developer/OSS/lit/lit`.
- Tenets: [`.agents/skills/product-tenets/SKILL.md`](../../.agents/skills/product-tenets/SKILL.md).
