# @stainless-code/angular-layers

Open any layer from anywhere in Angular and manage modal, dialog, drawer, popover, and toast UI as ordered, named stacks. `@stainless-code/angular-layers` adds Angular signals, DI, and imperative rendering helpers to [@stainless-code/layers](https://github.com/stainless-code/layers); awaiting a typed result and fire-and-forget invocation (`void client.open(...)`) are equally first-class.

Named stacks, singletons via `upsert` with live `update`, serial queues, nested child stacks, transitions, dismissal blockers, and validation provide standalone value. Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/angular-layers
```

`@stainless-code/layers` core is pulled in automatically and re-exported. `@angular/core` is a required peer (`>=17.0.0`, signals).

## Getting started

### 1. Declare a layer

Register an Angular component on the layer. Layer components receive `@Input()` fields matching `LayerComponentProps` (`call`, `payload`, `phase`, `actionStatus`, …).

```ts
import { Component, Input } from "@angular/core";
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/angular-layers";

export type ConfirmPayload = {
  title: string;
  message: string;
};
export type ConfirmResponse = boolean;

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  template: `
    <div role="dialog">
      <h2>{{ payload.title }}</h2>
      <p>{{ payload.message }}</p>
      <button type="button" (click)="call.end(true)">Yes</button>
      <button type="button" (click)="call.end(false)">No</button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  @Input({ required: true })
  call!: LayerComponentProps<ConfirmPayload, ConfirmResponse>["call"];

  @Input({ required: true })
  payload!: ConfirmPayload;
}

export const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialogComponent,
  exitingDelay: 200,
});
```

### 2. Provide the client and mount the stack

```ts
import type { ApplicationConfig } from "@angular/core";
import { provideLayerClient } from "@stainless-code/angular-layers";

export const appConfig: ApplicationConfig = {
  providers: [provideLayerClient()],
};
```

Call `renderStack` in an **injection context** (e.g. a host component constructor). It imperatively renders each active layer's registered component into a `ViewContainerRef` via `createComponent` + `setInput`. Components are keyed by stable layer `id` — state changes update inputs without recreating the `ComponentRef`.

```ts
import { Component, ViewContainerRef } from "@angular/core";
import { renderStack } from "@stainless-code/angular-layers";

@Component({
  selector: "app-confirm-host",
  standalone: true,
  template: "",
})
export class ConfirmHostComponent {
  constructor(vcr: ViewContainerRef) {
    renderStack(vcr, "confirm");
  }
}
```

Place `<app-confirm-host />` once near the root (or call `renderStack` against any `ViewContainerRef` outlet — including one from `@ViewChild`). Outside a constructor, wrap the call in `runInInjectionContext(injector, () => renderStack(vcr, stack))`.

For fully custom hosts, use `useStackHandles(stack?, rootProps?)` → `{ states, getCall }` and iterate the `states` signal yourself.

### 3. Call and await

```ts
import { Component } from "@angular/core";
import { useLayerClient } from "@stainless-code/angular-layers";
import { confirm, type ConfirmResponse } from "./confirm.layer";

@Component({
  selector: "app-remove-button",
  standalone: true,
  template: `<button type="button" (click)="remove()">Remove</button>`,
})
export class RemoveButtonComponent {
  private readonly client = useLayerClient();

  async remove() {
    const ok: ConfirmResponse = await this.client.open({
      ...confirm,
      payload: { title: "Remove?", message: "Sure?" },
    });
    // ok: boolean
  }
}
```

`ConfirmResponse` is inferred from `layerOptions<ConfirmPayload, ConfirmResponse>` — no explicit generics on `open`.

When `P` is `void`, `unknown`, `undefined`, or a union containing `undefined`, omit the `payload` key; `R` defaults to `void`. This no-payload toast is opened fire-and-forget and dismissed without a response:

```ts
import { Component, Input } from "@angular/core";
import {
  layerOptions,
  type LayerComponentProps,
  useLayerClient,
} from "@stainless-code/angular-layers";

@Component({
  selector: "app-saved-toast",
  standalone: true,
  template: `
    <div role="status">
      Saved
      <button type="button" (click)="call.dismiss()">Dismiss</button>
    </div>
  `,
})
export class SavedToastComponent {
  @Input({ required: true }) call!: LayerComponentProps["call"];
}

export const savedToast = layerOptions<void>({
  stack: "toast",
  key: ["toast", "saved"],
  component: SavedToastComponent,
});

@Component({
  selector: "app-save-button",
  standalone: true,
  template: `<button type="button" (click)="showSaved()">Save</button>`,
})
export class SaveButtonComponent {
  private readonly client = useLayerClient();

  showSaved() {
    void this.client.open(savedToast);
  }
}
```

Mount the toast stack the same way — `renderStack(vcr, "toast")` in a host component.

## Angular divergences from React

The package builds compiler-free with tsdown, so **no adapter-shipped `@Component` outlets** (`StackOutlet`, `Outlet`, `AppHost`, `AppLayer`, `StackProvider`). Rendering is imperative:

| React                                                      | Angular                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `<StackProvider>`                                          | `provideLayerClient()` in app config                                                    |
| `<StackOutlet stack="…" />`                                | `renderStack(vcr, stack)` or `renderInto(vcr)` from `useLayerGroup` / `createStackHook` |
| `<StackSubscribe selector={…}>`                            | `useStack(stackId, selector)` — a `Signal`, not a component                             |
| `createStackHook` → `{ StackProvider, AppHost, AppLayer }` | `createStackHook` → `{ provideClient, useAppStack, renderInto }`                        |

Use `useStack(stack, selector)` for isolated subscriptions; there is no `StackSubscribe` render-prop component.

## API

All imports from `@stainless-code/angular-layers`.

### Provider & client

| Export               | Signature                                   | Role                                              |
| -------------------- | ------------------------------------------- | ------------------------------------------------- |
| `LAYER_CLIENT`       | `InjectionToken<LayerClient>`               | DI token for the app client                       |
| `provideLayerClient` | `(client?: LayerClient) => FactoryProvider` | Add to `providers`; creates a client when omitted |
| `useLayerClient`     | `() => LayerClient`                         | `inject(LAYER_CLIENT)` — injection context only   |

### Subscriptions

- **`useStack(stackId?, selector?, compare?) => Signal<T>`** — default `T` is `LayerState[]`; `compare` defaults to `Object.is`. Explicit-client overload: `(client, stackId?, selector?, compare?)`.
- **`useLayer(key, stackId?, compare?) => Signal<LayerState | null>`** — one layer by key; `null` when inactive. `DataTag` keys infer `R` and `E`. Explicit-client overload available.

`useStack` and `useLayer` return read-only signals and must run in an injection context (they use `effect()` internally).

```ts
readonly count = useStack("confirm", (states) => states.length);
readonly top = useStack("confirm", (states) => states.at(-1) ?? null);
```

### Rendering

- **`renderStack(vcr, stack?, rootProps?) => void`** — imperative outlet; renders registered `component` types into `vcr`. Injection context only.
- **`useStackHandles(stack?, rootProps?) => StackHandles`** — headless `{ states: Signal<LayerState[]>, getCall }` for custom `@for` hosts.

### Nested stacks & async actions

- **`useLayerGroup(call, options?) => LayerGroup`** — child stack scoped to a parent layer's lifetime. Returns `{ open, dismissAll, states, stackId, renderInto }`. Call `renderInto(vcr)` instead of mounting an outlet component.
- **`useMutationFlow(call) => MutationFlow<R>`** — `{ pending: Signal<boolean>, run }`. `run(fn).orEnd(response)` ends on success; leaves the layer open and rethrows on failure. Use `flow.pending()` in templates:

```html
<button [disabled]="flow.pending()" (click)="save()">Confirm</button>
```

Call `useMutationFlow` in an injection context (e.g. the layer component constructor).

### App chrome factory

| Export                | Signature                            | Role                                                                      |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| **`createStackHook`** | `({ stack?, client? }) => StackHook` | Bind stack id once. Returns `{ provideClient, useAppStack, renderInto }`. |

- **`useAppStack()`** — `{ open, dismissAll, states }` with `stack` pre-bound.
- **`renderInto(vcr, rootProps?)`** — imperative outlet for the bound stack.

No `StackProvider`, `AppHost`, or `AppLayer` components — register `provideClient()` in config and call `renderInto(vcr)` from a host.

### Angular-specific types

`StackHandles`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `StackHook`.

### Core re-exports

`export * from "@stainless-code/layers"` — import core APIs from the same path: `LayerClient`, `layerOptions`, `layerKey`, `createCallContext`, `createLayerGroup`, `Layer`, `LayerStack`, `LayerComponentProps`, `PayloadValidationError`, `isPayloadValidationError`, types (`LayerState`, `LayerCallContext`, `DataTag`, …), and the rest of the zero-dep engine.

Engine concepts (transitions, blockers, validation, serial scope, `gcTime`) live in core — see the [`layers` skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) and [architecture](https://github.com/stainless-code/layers/blob/main/docs/architecture.md).

Full guide: [repo README](https://github.com/stainless-code/layers#readme).
