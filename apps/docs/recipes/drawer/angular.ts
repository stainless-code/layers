import { Component, inject, signal, ViewContainerRef } from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  useLayerClient,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface DrawerPayload {
  title: string;
}
type DrawerResponse = boolean;

@Component({
  selector: "drawer-layer",
  template: `
    <div aria-hidden="true" (click)="call.end(false)"></div>
    <div role="dialog" aria-modal="true">
      <h2>{{ payload.title }}</h2>
      <p>Edit your settings here. Save or cancel to close the drawer.</p>
      <button type="button" (click)="call.end(false)">Cancel</button>
      <button type="button" (click)="call.end(true)">Save</button>
    </div>
  `,
})
class DrawerComponent {
  call!: LayerComponentProps<DrawerPayload, DrawerResponse>["call"];
  payload!: DrawerPayload;
}

const drawer = layerOptions<DrawerPayload, DrawerResponse>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: DrawerComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="openDrawer()">Open drawer</button>
    @if (result() !== null) {
      <span>Result: {{ result() }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private client = useLayerClient();
  private vcr = inject(ViewContainerRef);
  result = signal<boolean | null>(null);

  constructor() {
    renderStack(this.vcr, "example-drawer");
  }

  async openDrawer() {
    this.result.set(null);
    const saved = await this.client.open({
      ...drawer,
      payload: { title: "Settings" },
    });
    this.result.set(saved);
  }
}
