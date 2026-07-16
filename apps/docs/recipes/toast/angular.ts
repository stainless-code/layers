import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewContainerRef,
} from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  useLayerClient,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface ToastPayload {
  message: string;
}

@Component({
  selector: "toast-layer",
  template: `
    <div role="status" aria-live="polite">
      <span>{{ payload.message }}</span>
      <button type="button" (click)="call.dismiss()" aria-label="Dismiss">
        ×
      </button>
    </div>
  `,
})
class ToastComponent implements OnInit, OnDestroy {
  call!: LayerComponentProps<ToastPayload, void>["call"];
  payload!: ToastPayload;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.timer = setTimeout(() => this.call.dismiss(), 2500);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }
}

const toast = layerOptions<ToastPayload, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: ToastComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="showToast()">Show toast</button>
    @if (fired()) {
      <span>Toast fired</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private client = useLayerClient();
  private vcr = inject(ViewContainerRef);
  fired = signal(false);

  constructor() {
    renderStack(this.vcr, "example-toast");
  }

  showToast() {
    void this.client.open({
      ...toast,
      payload: { message: "Changes saved" },
    });
    this.fired.set(true);
  }
}
