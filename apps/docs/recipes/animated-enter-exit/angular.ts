import {
  Component,
  inject,
  OnChanges,
  signal,
  SimpleChanges,
  ViewContainerRef,
} from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  injectLayer,
} from "@stainless-code/angular-layers";
import type {
  LayerComponentProps,
  LayerTransition,
} from "@stainless-code/angular-layers";

interface AnimatedPayload {
  title: string;
}

const EXIT_MS = 200;

@Component({
  selector: "animated-dialog",
  template: `
    <div role="dialog" aria-modal="true">
      <h2>{{ payload.title }}</h2>
      <p>
        Watch the enter and exit animation. Close to see the exit transition.
      </p>
      <button type="button" (click)="call.dismiss()">Close</button>
      <p>transition: {{ transition }}</p>
    </div>
  `,
})
class AnimatedDialogComponent implements OnChanges {
  call!: LayerComponentProps<AnimatedPayload, void>["call"];
  payload!: AnimatedPayload;
  transition!: LayerTransition;
  private settleTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges) {
    if (!changes["transition"]) return;
    if (this.settleTimer) clearTimeout(this.settleTimer);
    if (this.transition === "entering" || this.transition === "exiting") {
      this.settleTimer = setTimeout(() => this.call.settle(), EXIT_MS);
    }
  }
}

const animated = layerOptions<AnimatedPayload, void>({
  stack: "example-animated",
  key: ["example-animated"],
  component: AnimatedDialogComponent,
  enteringDelay: EXIT_MS,
  exitingDelay: EXIT_MS,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="openDialog()">Open animated dialog</button>
    @if (status() !== "idle") {
      <span>{{ status() === "open" ? "Open" : "Closed (exit animated)" }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private c = injectLayer(animated);
  private vcr = inject(ViewContainerRef);
  status = signal<"idle" | "open" | "closed">("idle");

  constructor() {
    renderStack(this.vcr, "example-animated");
  }

  openDialog() {
    this.status.set("open");
    void this.c
      .open({
        title: "Animated dialog",
      })
      .then(() => {
        this.status.set("closed");
      });
  }
}
