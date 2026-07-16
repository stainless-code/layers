import {
  Component,
  inject,
  Injector,
  Input,
  runInInjectionContext,
  signal,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/angular-layers";
import type {
  LayerCallContext,
  LayerComponentProps,
  LayerGroup,
} from "@stainless-code/angular-layers";

interface ParentPayload {
  title: string;
}
interface ChildPayload {
  title: string;
}
type ChildResponse = boolean;

@Component({
  selector: "child-confirm",
  template: `
    <div role="dialog" aria-modal="true">
      <h3>{{ payload.title }}</h3>
      <button type="button" (click)="call.end(false)">Cancel</button>
      <button type="button" (click)="call.end(true)">Confirm</button>
    </div>
  `,
})
class ChildConfirmComponent {
  call!: LayerComponentProps<ChildPayload, ChildResponse>["call"];
  payload!: ChildPayload;
}

const childConfirm = layerOptions<ChildPayload, ChildResponse>({
  key: ["example-nested", "child-confirm"],
  component: ChildConfirmComponent,
});

@Component({
  selector: "parent-dialog",
  standalone: true,
  template: `
    <div role="dialog" aria-modal="true" [attr.aria-label]="payload.title">
      <h2>{{ payload.title }}</h2>
      <p>Remove this item from the list?</p>
      <button type="button" (click)="deleteItem()">Delete item</button>
      <button type="button" (click)="call.dismiss()">Close</button>
      @if (childResult() !== null) {
        <span>Child result: {{ childResult() }}</span>
      }
      <ng-container #childOutlet />
    </div>
  `,
})
class ParentDialogComponent {
  @Input({ required: true }) call!: LayerCallContext<ParentPayload, void>;
  @Input({ required: true }) payload!: ParentPayload;

  @ViewChild("childOutlet", { read: ViewContainerRef, static: true })
  childOutlet!: ViewContainerRef;

  private readonly injector = inject(Injector);
  private group!: LayerGroup;
  childResult = signal<boolean | null>(null);

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.group = useLayerGroup(this.call);
      this.group.renderInto(this.childOutlet);
    });
  }

  async deleteItem() {
    this.childResult.set(null);
    const ok = await this.group.open({
      ...childConfirm,
      payload: { title: "Really delete this item?" },
    });
    this.childResult.set(ok);
  }
}

const parentDialog = layerOptions<ParentPayload, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialogComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="openParent()">Open parent dialog</button>
    <ng-container />
  `,
})
export class AppComponent {
  private client = useLayerClient();
  private vcr = inject(ViewContainerRef);

  constructor() {
    renderStack(this.vcr, "example-nested");
  }

  openParent() {
    void this.client.open({
      ...parentDialog,
      payload: { title: "Edit item" },
    });
  }
}
