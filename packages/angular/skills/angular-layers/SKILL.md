---
name: angular-layers
description: Angular adapter for @stainless-code/angular-layers (signals + DI + imperative renderStack); use when wiring provideLayerClient, renderStack/useStackHandles, useLayerGroup, useMutationFlow, or createStackHook
license: MIT
keywords:
  - tanstack-intent
  - angular
  - modal
  - dialog
  - stack
  - typescript
metadata:
  library: "@stainless-code/angular-layers"
  library_version: "0.1.0"
  framework: "angular"
sources:
  - https://github.com/stainless-code/layers/blob/main/packages/angular/README.md
  - https://github.com/stainless-code/layers/blob/main/docs/architecture.md
---

# Angular layer/stack UI with @stainless-code/angular-layers

Open any layer from anywhere in Angular and manage modal, dialog, drawer, popover, and toast UI as ordered, named stacks. Awaiting a typed result and fire-and-forget invocation (`void client.open(...)`) are equally first-class; named stacks, singletons via `upsert` with live `update`, serial queues, nested child stacks, transitions, dismissal blockers, and validation also provide standalone value.

The package re-exports `@stainless-code/layers`, so adapter and core APIs share one import path. It builds compiler-free with tsdown — ergonomic wrappers (`renderStack`, `useStackHandles`, `useLayerGroup`, `useMutationFlow`, `createStackHook`) use an **imperative** rendering model instead of adapter-shipped outlet components. See the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md), [architecture](https://github.com/stainless-code/layers/blob/main/docs/architecture.md), and [repository README](https://github.com/stainless-code/layers#readme).

## When to use this skill

Reach for `@stainless-code/angular-layers` to open overlay UI imperatively from anywhere and manage ordered, named stacks instead of prop-drilling, lifting state, or threading callbacks.

It fits when you need any of:

- Open or close overlay UI from anywhere.
- Await a typed result or fire and forget with `void client.open(...)`; both are first-class.
- Named stacks, singletons via `upsert` with live `update`, or serial queues.
- Nested stacks with `useLayerGroup`, transitions, dismissal guards, or validation.

Skip it only for a single always-local overlay with no return, stacking, queue, animation, or guard needs and no wish for a global registry.

Full fit matrix: [README — When to use it](https://github.com/stainless-code/layers#when-to-use-it).

## Install

```bash
bun add @stainless-code/angular-layers
```

Core is included. `@angular/core` (`>=17.0.0`, signals) is a required peer; install it separately if the app does not provide it.

## Declare → Mount → Call

```ts
// 1. Declare — register a component on the layer
import { Component, Input } from "@angular/core";
import {
  layerOptions,
  type LayerComponentProps,
} from "@stainless-code/angular-layers";

export type ConfirmPayload = { title: string };
export type ConfirmResponse = boolean;

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  template: `
    <div role="dialog">
      <h2>{{ payload.title }}</h2>
      <button type="button" (click)="call.end(true)">Yes</button>
      <button type="button" (click)="call.end(false)">No</button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  @Input({ required: true })
  call!: LayerComponentProps<ConfirmPayload, ConfirmResponse>["call"];
  @Input({ required: true }) payload!: ConfirmPayload;
}

export const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialogComponent,
  exitingDelay: 200,
});

@Component({
  selector: "app-saved-toast",
  standalone: true,
  template: `<div role="status">Saved</div>`,
})
export class SavedToastComponent {
  @Input({ required: true }) call!: LayerComponentProps["call"];
}

export const savedToast = layerOptions<void>({
  stack: "toast",
  key: ["toast", "saved"],
  component: SavedToastComponent,
});
```

```ts
// 2. Provide one client + imperatively mount the stack
import type { ApplicationConfig, FactoryProvider } from "@angular/core";
import { Component, ViewContainerRef } from "@angular/core";
import {
  LAYER_CLIENT,
  LayerClient,
  provideLayerClient,
  renderStack,
} from "@stainless-code/angular-layers";

const provider: FactoryProvider = provideLayerClient();

export const appConfig: ApplicationConfig = {
  providers: [provider],
};

@Component({
  selector: "app-confirm-host",
  standalone: true,
  template: "",
})
export class ConfirmHostComponent {
  constructor(vcr: ViewContainerRef) {
    renderStack(vcr, "confirm"); // injection context required
  }
}

// Equivalent custom registration:
const customProvider: FactoryProvider = {
  provide: LAYER_CLIENT,
  useFactory: () => new LayerClient(),
};
```

`renderStack(vcr, stack?, rootProps?)` creates each layer's registered component via `ViewContainerRef.createComponent` + `setInput`, keyed by stable layer `id` so state changes update inputs without remounting. `injectLayer`, `injectLayerState`, `useStack`, `renderStack`, `useStackHandles`, `useLayerGroup`, and `useMutationFlow` must run in an Angular injection context — typically a component constructor or field initializer. Outside a constructor, use `runInInjectionContext(injector, () => …)`.

```ts
// 3. Call & await — injectLayer binds identity; open takes payload only
import { Component } from "@angular/core";
import { injectLayer, useLayerClient } from "@stainless-code/angular-layers";
import { confirm, savedToast, type ConfirmResponse } from "./confirm.layer";

@Component({
  selector: "app-opener",
  standalone: true,
  template: `
    <button type="button" (click)="open()">Remove</button>
    <button type="button" (click)="showSaved()">Save</button>
  `,
})
export class OpenerComponent {
  private readonly c = injectLayer(confirm);
  private readonly client = useLayerClient();

  async open() {
    const ok: ConfirmResponse = await this.c.open({ title: "Remove?" });
    // ok: boolean
  }

  showSaved() {
    void this.client.open(savedToast);
  }
}
```

When `P` is `void`, `unknown`, `undefined`, or a union containing `undefined`, omit the `payload` key; `R` defaults to `void`. Accordingly, `savedToast` opens fire-and-forget with neither `await` nor a `payload` key.

## The `call` context

Each mounted layer gets a `LayerCallContext` from `createCallContext(stack, layer, state)` (or via `useStackHandles().getCall(state)` / `renderStack`'s `call` input). It provides `end`, `dismiss`, `update`, `setRunning`, `settle`, `ended`, `index`, `stackSize`, `root`, `stackId`, `layerId`, and `addBlocker`; the `LayerState` snapshot provides `payload`, `data`, `error`, `phase`, `transition`, `actionStatus`, and `dismissing`. Use `await call.end(response)` to resolve the caller's `await` and dismiss the layer (`Promise<boolean>`; `false` when a blocker vetoes).

**Key vs id:** `key` is the logical identity used by `find`, `upsert`, and `gcTime`; each mount gets a unique instance `id`. Track `s.id` in `@for` because parallel stacks may contain multiple layers with the same key.

## Wired handle: injectLayer

```ts
readonly c = injectLayer(confirm);
await this.c.open({ title: "Remove?" });
```

## Subscribing to stacks

Options-bag + optional trailing `client`; `select` (not `selector`).

### useStack / injectQueuedStack

```ts
readonly stack = useStack({ stack: "confirm" });
readonly count = useStack({ stack: "confirm", select: (s) => s.length });
readonly queued = injectQueuedStack({ stack: "confirm" });
```

### injectLayerState / injectLayerQueuedState

Observe-only; `Signal<LayerState[]>` for all same-key instances:

```ts
readonly states = injectLayerState({ key: confirm.key, stack: "confirm" });
readonly top = computed(() => this.states().at(-1));
```

## Rendering layers

### renderStack (recommended)

Call `renderStack(vcr, stack?, rootProps?)` in an injection context. Each active layer's registered `component` is created into `vcr`; missing `component` renders nothing and warns in development.

Layer components declare `@Input()` fields matching `LayerComponentProps` — at minimum `call` and `payload`; `renderStack` also sets `data`, `error`, `phase`, `transition`, `actionStatus`, and `dismissing`.

```ts
import { Component, Input, ViewContainerRef } from "@angular/core";
import {
  renderStack,
  type LayerComponentProps,
} from "@stainless-code/angular-layers";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  template: `<div role="dialog">…</div>`,
})
export class ConfirmDialogComponent {
  @Input({ required: true })
  call!: LayerComponentProps<ConfirmPayload, ConfirmResponse>["call"];
  @Input({ required: true }) payload!: ConfirmPayload;
  @Input({ required: true }) actionStatus!: LayerComponentProps<
    ConfirmPayload,
    ConfirmResponse
  >["actionStatus"];
}

@Component({
  selector: "app-stack-host",
  standalone: true,
  template: `<ng-container #outlet />`,
})
export class StackHostComponent {
  constructor(vcr: ViewContainerRef) {
    renderStack(vcr, "confirm");
  }
}
```

### useStackHandles (headless)

For fully custom hosts, `useStackHandles(stack?, rootProps?)` returns `{ states: Signal<LayerState[]>, getCall }`. Iterate `states()` in `@for` and pass `getCall(state)` to your own components:

```ts
import { Component } from "@angular/core";
import {
  useStackHandles,
  type LayerCallContext,
  type LayerState,
} from "@stainless-code/angular-layers";

@Component({
  selector: "app-confirm-outlet",
  standalone: true,
  template: `
    @for (state of handles.states(); track state.id) {
      <app-confirm-dialog
        [call]="handles.getCall(state)"
        [payload]="state.payload"
      />
    }
  `,
})
export class ConfirmOutletComponent {
  readonly handles = useStackHandles("confirm");
}
```

### Angular vs React rendering

The adapter ships **no** `StackOutlet`, `Outlet`, `AppHost`, `AppLayer`, or `StackProvider` components — the package is compiler-free. React mounts `<StackOutlet />`; Angular calls `renderStack(vcr, stack)` or `group.renderInto(vcr)` / `stackHook.renderInto(vcr)`. There is no `StackSubscribe`; use `useStack({ select })` instead.

## Nested layers

Use `useLayerGroup(call, options?)` inside a layer component (injection context). The child stack is disposed and dismissed when the parent layer unmounts.

```ts
import {
  Component,
  inject,
  Injector,
  Input,
  runInInjectionContext,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import {
  useLayerGroup,
  type LayerCallContext,
  type LayerGroup,
} from "@stainless-code/angular-layers";

@Component({
  selector: "app-parent-drawer",
  standalone: true,
  template: `
    <button type="button" (click)="openChild()">Advanced</button>
    <ng-container #childOutlet />
  `,
})
export class ParentDrawerComponent {
  @Input({ required: true }) call!: LayerCallContext<unknown, unknown>;

  @ViewChild("childOutlet", { read: ViewContainerRef, static: true })
  childOutlet!: ViewContainerRef;

  private readonly injector = inject(Injector);
  private group!: LayerGroup;

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.group = useLayerGroup(this.call, { name: "advanced" });
      this.group.renderInto(this.childOutlet);
    });
  }

  openChild() {
    void this.group.open({ key: ["drawer", "child"], payload: { step: 2 } });
  }
}
```

Returns `{ open, dismissAll, states, stackId, renderInto }`. For low-level control, core `createLayerGroup(client, parent, options?)` is still available via re-export.

## Async actions

`useMutationFlow(call)` coordinates pending state with async work and ends the layer on success:

```ts
import { Component, Input } from "@angular/core";
import {
  useMutationFlow,
  type LayerComponentProps,
} from "@stainless-code/angular-layers";

@Component({
  selector: "app-save-dialog",
  standalone: true,
  template: `
    <button [disabled]="flow.pending()" (click)="save()">Confirm</button>
  `,
})
export class SaveDialogComponent {
  @Input({ required: true })
  call!: LayerComponentProps<ConfirmPayload, ConfirmResponse>["call"];

  readonly flow = useMutationFlow(this.call);

  save() {
    void this.flow.run(() => this.persist()).orEnd(true);
  }

  private async persist() {
    await saveToServer();
  }
}
```

`pending` is a `Signal<boolean>` — call `flow.pending()` in templates. `run(fn).orEnd(response)` sets `actionStatus: "running"`, runs `fn`, then calls `call.end(response)`; failures leave the layer open and rethrow.

For manual control, `call.setRunning(true)` / `call.setRunning(false)` in `try`/`finally` still works.

## App chrome factory

Bind a stack once with `createStackHook({ stack?, client? })`:

```ts
import { Component, ViewContainerRef } from "@angular/core";
import { createStackHook } from "@stainless-code/angular-layers";

const confirmStack = createStackHook({ stack: "confirm" });

// app.config.ts providers: [confirmStack.provideClient()]
// or confirmStack.provideClient(existingClient)

@Component({
  selector: "app-confirm-root",
  standalone: true,
  template: "",
})
export class ConfirmRootComponent {
  constructor(vcr: ViewContainerRef) {
    confirmStack.renderInto(vcr);
  }
}

@Component({
  selector: "app-opener",
  standalone: true,
  template: `<button type="button" (click)="remove()">Remove</button>`,
})
export class OpenerComponent {
  private readonly stack = confirmStack.useAppStack();

  async remove() {
    await this.stack.open({ ...confirm, payload: { title: "Remove?" } });
  }
}
```

Returns `{ provideClient, useAppStack, renderInto }` — register `provideClient()` in app config, then call `renderInto(vcr)` from a host component to mount the bound stack (no component-style host; see § Angular vs React rendering).

## Adapter API

| Name                     | Signature / shape                                                          |
| ------------------------ | -------------------------------------------------------------------------- |
| `LAYER_CLIENT`           | `InjectionToken<LayerClient>`                                              |
| `provideLayerClient`     | `(client?: LayerClient) => FactoryProvider`                                |
| `useLayerClient`         | `() => LayerClient`                                                        |
| `injectLayer`            | `(options, client?) => WiredLayerHandle signals + state/queued/top`        |
| `injectLayerState`       | `({ key, stack?, select?, compare? }, client?) => Signal<LayerState[]>`    |
| `injectLayerQueuedState` | `({ key, stack?, select?, compare? }, client?) => Signal<LayerState[]>`    |
| `useStack`               | `({ stack?, select?, compare? }, client?) => Signal<T>`                    |
| `injectQueuedStack`      | `({ stack?, select?, compare? }, client?) => Signal<T>`                    |
| `renderStack`            | `(vcr, stack?, rootProps?) => void` — imperative outlet; injection context |
| `useStackHandles`        | `(stack?, rootProps?) => { states, getCall }`                              |
| `useMutationFlow`        | `(call) => { pending: Signal<boolean>, run }`                              |
| `useLayerGroup`          | `(call, options?) => { open, dismissAll, states, stackId, renderInto }`    |
| `createStackHook`        | `({ stack?, client? }) => { provideClient, useAppStack, renderInto }`      |

Types: `StackHandles`, `MutationRun<R>`, `MutationFlow<R>`, `ScopedOpen`, `LayerGroup`, `AppStack`, `StackHook`.

## Core re-exports (same import path)

Core exports are available from `@stainless-code/angular-layers`, including `LayerClient`, `LayerStack`, `layerOptions`, `layerKey`, `LayerState`, `LayerCallContext`, `LayerComponentProps`, `createCallContext`, `createLayerGroup`, `DataTag`, `ResponseOf`, and `ErrorOf`:

- **Key inference:** `layerOptions` / `layerKey` `DataTag` branding — `await client.open(...)` infers `R`.
- **Singleton + live updates:** `upsert: true` on `open`; `client.getStack(id).update(layer, patch)`.
- **Serial scope:** `new LayerClient({ defaultStackOptions: { confirm: { scope: { strategy: "serial" } } } })` — pass to `provideLayerClient(client)`.
- **Validation:** `validate` on `layerOptions` or `open`; narrow `PayloadValidationError` via `isPayloadValidationError`.
- **Blockers:** `call.addBlocker` / `stack.addBlocker`; `dismissing` flag; `dismissAll` modes.

See the [`layers` core skill](https://github.com/stainless-code/layers/blob/main/packages/core/skills/layers/SKILL.md) for full engine coverage.
