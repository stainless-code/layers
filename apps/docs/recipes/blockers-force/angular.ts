import {
  Component,
  effect,
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
interface DiscardPayload {
  title: string;
  message: string;
}
type ParentResponse = boolean;
type DiscardResponse = boolean;

@Component({
  selector: "discard-confirm",
  template: `
    <div role="alertdialog" aria-modal="true">
      <h3>{{ payload.title }}</h3>
      <p>{{ payload.message }}</p>
      <button type="button" (click)="call.end(false)">Cancel</button>
      <button type="button" (click)="call.end(true)">Discard</button>
    </div>
  `,
})
class DiscardConfirmComponent {
  call!: LayerComponentProps<DiscardPayload, DiscardResponse>["call"];
  payload!: DiscardPayload;
}

const discardConfirm = layerOptions<DiscardPayload, DiscardResponse>({
  key: ["example-blockers-force", "discard"],
  component: DiscardConfirmComponent,
});

@Component({
  selector: "edit-dialog",
  standalone: true,
  template: `
    <div role="dialog" aria-modal="true" [attr.aria-label]="payload.title">
      <h2>{{ payload.title }}</h2>
      <input
        type="text"
        [value]="text()"
        (input)="text.set($any($event.target).value)"
        placeholder="Type to make the form dirty…"
      />
      @if (dismissing) {
        <p>blocker consulted → vetoed</p>
      }
      <button type="button" (click)="attemptClose()">Close</button>
      <button type="button" (click)="call.end(true, { force: true })">
        Force close
      </button>
      <ng-container #childOutlet />
    </div>
  `,
})
class EditDialogComponent {
  @Input({ required: true }) call!: LayerCallContext<
    ParentPayload,
    ParentResponse
  >;
  @Input({ required: true }) payload!: ParentPayload;
  @Input({ required: true }) dismissing!: LayerComponentProps<
    ParentPayload,
    ParentResponse
  >["dismissing"];

  @ViewChild("childOutlet", { read: ViewContainerRef, static: true })
  childOutlet!: ViewContainerRef;

  private readonly injector = inject(Injector);
  private group!: LayerGroup;
  text = signal("");

  ngOnInit() {
    runInInjectionContext(this.injector, () => {
      this.group = useLayerGroup(this.call, { name: "discard" });
      this.group.renderInto(this.childOutlet);
      effect((onCleanup) => {
        onCleanup(this.call.addBlocker(() => this.text().length === 0));
      });
    });
  }

  async attemptClose() {
    if (this.text().length === 0) {
      this.call.end(false);
      return;
    }
    const discard = await this.group.open({
      ...discardConfirm,
      payload: {
        title: "Discard changes?",
        message: "You'll lose your unsaved edits.",
      },
    });
    if (discard) this.call.end(false, { force: true });
  }
}

const edit = layerOptions<ParentPayload, ParentResponse>({
  stack: "example-blockers-force",
  key: ["example-blockers-force", "parent"],
  component: EditDialogComponent,
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient()],
  template: `
    <button type="button" (click)="openForm()">Open form</button>
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
    renderStack(this.vcr, "example-blockers-force");
  }

  async openForm() {
    this.result.set(null);
    this.result.set(
      await this.client.open({
        ...edit,
        payload: { title: "Edit profile" },
      }),
    );
  }
}
