import {
  Component,
  effect,
  inject,
  signal,
  ViewContainerRef,
} from "@angular/core";
import {
  LayerClient,
  layerOptions,
  provideLayerClient,
  renderStack,
  injectLayer,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

const STACK_ID = "example-onboarding";

const layerClient = new LayerClient({
  defaultStackOptions: {
    [STACK_ID]: { scope: { strategy: "serial" } },
  },
});

interface StepPayload {
  step: number;
  title: string;
}

@Component({
  selector: "onboarding-step",
  template: `
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'Step ' + payload.step"
    >
      <p>Step {{ payload.step }} of 3</p>
      <h2>{{ payload.title }}</h2>
      <button type="button" (click)="call.end()">
        {{ payload.step < 3 ? "Next" : "Finish" }}
      </button>
    </div>
  `,
})
class OnboardingStepComponent {
  call!: LayerComponentProps<StepPayload, void>["call"];
  payload!: StepPayload;
}

const steps = [
  layerOptions<StepPayload, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 1],
    component: OnboardingStepComponent,
  }),
  layerOptions<StepPayload, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 2],
    component: OnboardingStepComponent,
  }),
  layerOptions<StepPayload, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 3],
    component: OnboardingStepComponent,
  }),
];

const stepPayloads = [
  { step: 1, title: "Welcome" },
  { step: 2, title: "Choose preferences" },
  { step: 3, title: "You're all set" },
] as const;

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient(layerClient)],
  template: `
    <button type="button" (click)="startOnboarding()">Start onboarding</button>
    @if (started() && queued() > 0) {
      <span>Queued: {{ queued() }}</span>
    }
    <ng-container />
  `,
})
export class AppComponent {
  private step0 = injectLayer(steps[0]!);
  private step1 = injectLayer(steps[1]!);
  private step2 = injectLayer(steps[2]!);
  private vcr = inject(ViewContainerRef);
  started = signal(false);
  queued = signal(0);

  constructor() {
    renderStack(this.vcr, STACK_ID);

    const stack = this.step0.stack;
    effect((onCleanup) => {
      const sync = () => this.queued.set(stack.getQueuedSnapshot().length);
      sync();
      onCleanup(stack.subscribe(sync));
    });
  }

  startOnboarding() {
    this.started.set(true);
    const handles = [this.step0, this.step1, this.step2];
    for (let i = 0; i < steps.length; i++) {
      void handles[i]!.open(stepPayloads[i]);
    }
  }
}
