import { Component, inject, signal, ViewContainerRef } from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  injectLayer,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface ProgressPayload {
  percent: number;
  label: string;
}

@Component({
  selector: "progress-overlay",
  template: `
    <div role="dialog" aria-modal="true" [attr.aria-label]="payload.label">
      <p>{{ payload.label }}</p>
      <progress [value]="payload.percent" max="100"></progress>
      <p>{{ payload.percent }}%</p>
    </div>
  `,
})
class ProgressOverlayComponent {
  call!: LayerComponentProps<ProgressPayload, void>["call"];
  payload!: ProgressPayload;
}

const progress = layerOptions<ProgressPayload, void>({
  stack: "example-progress",
  key: ["example-progress"],
  component: ProgressOverlayComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button
      type="button"
      [disabled]="status() === 'running'"
      (click)="startUpload()"
    >
      Start upload
    </button>
    @if (status() !== "idle") {
      <span>{{ status() === "running" ? "Uploading…" : "Complete" }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private c = injectLayer(progress);
  private vcr = inject(ViewContainerRef);
  status = signal<"idle" | "running" | "complete">("idle");

  constructor() {
    renderStack(this.vcr, "example-progress");
  }

  startUpload() {
    this.status.set("running");
    void this.c.open({ percent: 0, label: "Uploading file…" });
    const layer = this.c.stack.find(["example-progress"]);
    if (!layer) {
      this.status.set("idle");
      return;
    }

    let percent = 0;
    const interval = setInterval(() => {
      percent = Math.min(100, percent + 5);
      this.c.stack.update(layer, { percent });
      if (percent >= 100) {
        clearInterval(interval);
        void this.c.stack.dismiss(layer, undefined as void).then(() => {
          this.status.set("complete");
        });
      }
    }, 150);
  }
}
