import {
  LayerClient,
  layerOptions,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal, onMount } from "solid-js";

const STACK_ID = "example-onboarding";

const layerClient = new LayerClient({
  defaultStackOptions: {
    [STACK_ID]: { scope: { strategy: "serial" } },
  },
});

function OnboardingStep(
  props: LayerComponentProps<{ step: number; title: string }, void>,
) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Step ${props.payload.step}`}
    >
      <p>Step {props.payload.step} of 3</p>
      <h2>{props.payload.title}</h2>
      <button type="button" onClick={() => void props.call.end()}>
        {props.payload.step < 3 ? "Next" : "Finish"}
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
  const [queued, setQueued] = createSignal(0);

  onMount(() => {
    const sync = () => setQueued(stack.getQueuedSnapshot().length);
    sync();
    return stack.subscribe(sync);
  });

  return <>{queued() > 0 && <span>Queued: {queued()}</span>}</>;
}

function Trigger() {
  const client = useLayerClient();
  const [started, setStarted] = createSignal(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStarted(true);
          for (let i = 0; i < steps.length; i++) {
            void client.open({
              ...steps[i],
              payload: stepPayloads[i],
            });
          }
        }}
      >
        Start onboarding
      </button>
      {started() && <QueueReadout />}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={layerClient}>
      <StackOutlet stack={STACK_ID} />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
