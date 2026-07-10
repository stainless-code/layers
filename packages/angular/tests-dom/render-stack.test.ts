import {
  Component,
  inject,
  Injector,
  Input,
  runInInjectionContext,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { describe, expect, it, vi } from "vitest";

import { provideLayerClient, renderStack } from "../src/index";

let mountCount = 0;

@Component({
  selector: "confirm-dialog",
  standalone: true,
  template: `
    <div role="dialog" [attr.aria-label]="payload.title">
      <h2>{{ payload.title }}</h2>
      <p>{{ payload.message }}</p>
      <button type="button" (click)="call.end(true)">Yes</button>
      <button type="button" (click)="call.end(false)">No</button>
    </div>
  `,
})
class ConfirmDialogComponent {
  @Input({ required: true }) call!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["call"];
  @Input({ required: true }) payload!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["payload"];
  @Input() data?: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["data"];
  @Input() error?: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["error"];
  @Input({ required: true }) phase!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["phase"];
  @Input({ required: true }) transition!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["transition"];
  @Input({ required: true }) actionStatus!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["actionStatus"];
  @Input({ required: true }) dismissing!: LayerComponentProps<
    { title: string; message: string },
    boolean
  >["dismissing"];
}

@Component({
  selector: "status-dialog",
  standalone: true,
  template: `
    <div role="dialog" [attr.aria-label]="payload.title">
      <span data-testid="status">{{ actionStatus }}</span>
      <button type="button" (click)="call.setRunning(true)">Run</button>
      <button type="button" (click)="call.end(true)">Confirm</button>
    </div>
  `,
})
class StatusDialogComponent {
  constructor() {
    mountCount += 1;
  }

  @Input({ required: true }) call!: LayerComponentProps<
    { title: string },
    boolean
  >["call"];
  @Input({ required: true }) payload!: LayerComponentProps<
    { title: string },
    boolean
  >["payload"];
  @Input() data?: LayerComponentProps<{ title: string }, boolean>["data"];
  @Input() error?: LayerComponentProps<{ title: string }, boolean>["error"];
  @Input({ required: true }) phase!: LayerComponentProps<
    { title: string },
    boolean
  >["phase"];
  @Input({ required: true }) transition!: LayerComponentProps<
    { title: string },
    boolean
  >["transition"];
  @Input({ required: true }) actionStatus!: LayerComponentProps<
    { title: string },
    boolean
  >["actionStatus"];
  @Input({ required: true }) dismissing!: LayerComponentProps<
    { title: string },
    boolean
  >["dismissing"];
}

const confirmOptions = layerOptions<
  { title: string; message: string },
  boolean
>({
  stack: "confirm",
  key: ["confirm", "remove-export"],
  component: ConfirmDialogComponent,
  exitingDelay: 0,
});

const statusOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "status"],
  component: StatusDialogComponent,
  exitingDelay: 0,
});

const modalOptionsNoComponent = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "no-component"],
  exitingDelay: 0,
});

function createHost(stack = "confirm") {
  @Component({
    selector: "stack-host",
    standalone: true,
    template: `<ng-container #outlet></ng-container>`,
  })
  class StackHostComponent {
    @ViewChild("outlet", { read: ViewContainerRef, static: true })
    outlet!: ViewContainerRef;
    private readonly injector = inject(Injector);
    ngOnInit(): void {
      runInInjectionContext(this.injector, () =>
        renderStack(this.outlet, stack),
      );
    }
  }
  return StackHostComponent;
}

describe("Angular adapter — renderStack", () => {
  it("renders on open and removes on close", async () => {
    const client = new LayerClient();
    const Host = createHost();

    TestBed.configureTestingModule({
      providers: [provideLayerClient(client)],
    });

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export", message: "Are you sure?" },
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Are you sure?");

    const yesBtn = fixture.nativeElement.querySelector(
      "button",
    ) as HTMLButtonElement;
    yesBtn.click();
    await expect(pending).resolves.toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not remount the layer component when state changes", async () => {
    mountCount = 0;
    const client = new LayerClient();
    const Host = createHost();

    TestBed.configureTestingModule({
      providers: [provideLayerClient(client)],
    });

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    void client.open({
      ...statusOptions,
      payload: { title: "Status modal" },
    });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(mountCount).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="status"]')
        ?.textContent,
    ).toBe("idle");

    const runBtn = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    ).find(
      (b: HTMLButtonElement) => b.textContent === "Run",
    ) as HTMLButtonElement;
    runBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mountCount).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="status"]')
        ?.textContent,
    ).toBe("running");
  });

  it("renderStack dev-warns on missing component", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LayerClient();
    const Host = createHost("modal");

    TestBed.configureTestingModule({
      providers: [provideLayerClient(client)],
    });

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    void client.open({
      ...modalOptionsNoComponent,
      payload: { title: "No component" },
    });

    fixture.detectChanges();
    await fixture.whenStable();

    const warnMessage = warnSpy.mock.calls.find(([msg]) =>
      String(msg).includes("[layers/angular]"),
    );
    expect(warnMessage).toBeTruthy();
    expect(String(warnMessage?.[0])).toContain("No component for layer");
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector("button")).toBeNull();

    warnSpy.mockRestore();
  });
});
