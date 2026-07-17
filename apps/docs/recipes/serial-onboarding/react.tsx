import {
  LayerClient,
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect, useState } from "react";

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
    <div role="dialog" aria-modal="true" aria-label={`Step ${payload.step}`}>
      <p>Step {payload.step} of 3</p>
      <h2>{payload.title}</h2>
      <button type="button" onClick={() => void call.end()}>
        {payload.step < 3 ? "Next" : "Finish"}
      </button>
    </div>
  );
}

const steps = [
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 1],
    component: OnboardingStep,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 2],
    component: OnboardingStep,
  }),
  layerOptions<{ step: number; title: string }, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 3],
    component: OnboardingStep,
  }),
];

const stepPayloads = [
  { step: 1, title: "Welcome" },
  { step: 2, title: "Choose preferences" },
  { step: 3, title: "You're all set" },
] as const;

function QueueReadout() {
  const client = useLayerClient();
  const stack = client.getStack(STACK_ID);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const sync = () => setQueued(stack.getQueuedSnapshot().length);
    sync();
    return stack.subscribe(sync);
  }, [stack]);

  if (queued === 0) {
    return null;
  }

  return <span>Queued: {queued}</span>;
}

function Trigger() {
  const s1 = useLayer(steps[0]);
  const s2 = useLayer(steps[1]);
  const s3 = useLayer(steps[2]);
  const [started, setStarted] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStarted(true);
          void s1.open(stepPayloads[0]);
          void s2.open(stepPayloads[1]);
          void s3.open(stepPayloads[2]);
        }}
      >
        Start onboarding
      </button>
      {started && <QueueReadout />}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider client={layerClient}>
      <StackOutlet stack={STACK_ID} />
      <Trigger />
    </StackProvider>
  );
}
