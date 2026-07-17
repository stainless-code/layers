import { Component, inject, signal, ViewContainerRef } from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  injectLayer,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface ConfirmPayload {
  title: string;
}
type ConfirmResponse = boolean;

@Component({
  selector: "confirm-dialog",
  template: `
    <div role="dialog" aria-modal="true">
      <h2>{{ payload.title }}</h2>
      <button type="button" (click)="call.end(false)">No</button>
      <button type="button" (click)="call.end(true)">Yes</button>
    </div>
  `,
})
class ConfirmDialogComponent {
  call!: LayerComponentProps<ConfirmPayload, ConfirmResponse>["call"];
  payload!: ConfirmPayload;
}

const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmDialogComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="deleteFile()">Delete file</button>
    @if (result() !== null) {
      <span>Result: {{ result() }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private c = injectLayer(confirm);
  private vcr = inject(ViewContainerRef);
  result = signal<boolean | null>(null);

  constructor() {
    renderStack(this.vcr, "example-confirm");
  }

  async deleteFile() {
    this.result.set(null);
    const ok = await this.c.open({ title: "Delete this file?" });
    this.result.set(ok);
  }
}
