import { Component, inject, signal, ViewContainerRef } from "@angular/core";
import {
  createLayer,
  LayerClient,
  layerOptions,
  provideLayerClient,
  renderStack,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface GuardPayload {
  destination: string;
}
type GuardResponse = boolean;

const layerClient = new LayerClient();

@Component({
  selector: "guard-dialog",
  template: `
    <div role="dialog" aria-modal="true">
      <h2>Leave this page?</h2>
      <p>
        Unsaved changes may be lost. Navigate to
        <strong>{{ payload.destination }}</strong
        >?
      </p>
      <button type="button" (click)="call.end(false)">Stay</button>
      <button type="button" (click)="call.end(true)">Leave</button>
    </div>
  `,
})
class GuardDialogComponent {
  call!: LayerComponentProps<GuardPayload, GuardResponse>["call"];
  payload!: GuardPayload;
}

const guard = layerOptions<GuardPayload, GuardResponse>({
  stack: "example-route-guard",
  key: ["example-route-guard"],
  component: GuardDialogComponent,
});

const g = createLayer(guard, layerClient);

async function simulateNavigation(destination: string): Promise<string> {
  const ok = await g.open({ destination });
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient(layerClient)],
  template: `
    <button type="button" (click)="navigate()">Simulate navigation</button>
    @if (result() !== null) {
      <span>Result: {{ result() }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private vcr = inject(ViewContainerRef);
  result = signal<string | null>(null);

  constructor() {
    renderStack(this.vcr, "example-route-guard");
  }

  async navigate() {
    this.result.set(null);
    this.result.set(await simulateNavigation("/settings"));
  }
}
