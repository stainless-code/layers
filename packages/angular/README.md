# @stainless-code/angular-layers

<p align="center">
  <img src="https://stainless-code.com/layers/icon.svg" alt="Layers" height="48" />
</p>

Modals are just async functions you forgot to `await`.

The Angular adapter for Layers — open any layer from anywhere and `await` a typed result. State coordination, not UI ownership: Layers owns the stack/keys/transitions/await contract; you own rendering, focus, portals, and a11y.

> Experimental — the API may change between minor releases. Pin your version.

## Install

`bun add @stainless-code/angular-layers`

**Peer:** `@angular/core` (`>=17.0.0`)

## Taste

```ts
import { Component, ViewContainerRef, inject } from "@angular/core";
import {
  injectLayer,
  layerOptions,
  provideLayerClient,
  renderStack,
  type LayerComponentProps,
} from "@stainless-code/angular-layers";

@Component({
  selector: "confirm-dialog",
  template: `
    <div role="dialog">
      <h2>{{ payload.title }}</h2>
      <button type="button" (click)="call.end(true)">Yes</button>
      <button type="button" (click)="call.end(false)">No</button>
    </div>
  `,
})
class ConfirmDialogComponent {
  call!: LayerComponentProps<{ title: string }, boolean>["call"];
  payload!: { title: string };
}

export const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialogComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `<ng-container #outlet />`,
})
export class AppComponent {
  private vcr = inject(ViewContainerRef);
  constructor() {
    renderStack(this.vcr, "confirm");
  }
}

@Component({
  selector: "remove-btn",
  standalone: true,
  template: `<button type="button" (click)="remove()">Remove</button>`,
})
export class RemoveButtonComponent {
  private readonly c = injectLayer(confirm);

  async remove() {
    const ok = await this.c.open({
      title: "Remove?",
      message: "Sure?",
    });
    if (ok) deleteItem();
  }
}
```

## Docs

- [Angular adapter](https://stainless-code.com/layers/adapters/angular)
- [Getting started](https://stainless-code.com/layers/guides/getting-started)
- [When to use Layers](https://stainless-code.com/layers/concepts/when-to-use)
- [Stability & versioning](https://stainless-code.com/layers/concepts/stability)
- [Full docs](https://stainless-code.com/layers)

[Source on GitHub](https://github.com/stainless-code/layers/tree/main/packages/angular)
