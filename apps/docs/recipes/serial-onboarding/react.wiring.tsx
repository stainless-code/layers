import {
  LayerClient,
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

const STACK_ID = "example-onboarding";

const layerClient = new LayerClient({
  defaultStackOptions: {
    [STACK_ID]: { scope: { strategy: "serial" } },
  },
});

function OnboardingStep({
  call,
  payload,
}: LayerComponentProps<{ step: number; title: string }, void>) {
  return (
    <div role="dialog" aria-modal="true" aria-label={payload.title}>
      <span>
        Step {payload.step}: {payload.title}
      </span>
      <button onClick={() => call.end()}>Next</button>
    </div>
  );
}

const steps = [
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 1],
    component: OnboardingStep,
    enteringDelay: 200,
    exitingDelay: 200,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 2],
    component: OnboardingStep,
    enteringDelay: 200,
    exitingDelay: 200,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 3],
    component: OnboardingStep,
    enteringDelay: 200,
    exitingDelay: 200,
  }),
];

const stepPayloads = [
  { step: 1, title: "Welcome" },
  { step: 2, title: "Choose preferences" },
  { step: 3, title: "You're all set" },
] as const;

function Trigger() {
  const s1 = useLayer(steps[0]);
  const s2 = useLayer(steps[1]);
  const s3 = useLayer(steps[2]);
  const start = () => {
    // serial — opens play one at a time
    void s1.open(stepPayloads[0]);
    void s2.open(stepPayloads[1]);
    void s3.open(stepPayloads[2]);
  };
  return <button onClick={start}>Start onboarding</button>;
}

export default function SerialOnboardingWiring() {
  return (
    <StackProvider client={layerClient}>
      <StackOutlet stack={STACK_ID} />
      <Trigger />
    </StackProvider>
  );
}
