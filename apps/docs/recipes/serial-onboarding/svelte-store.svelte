<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import {
    type LayerCallContext,
    type LayerState,
    callFor,
    createLayer,
    LayerClient,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  const STACK_ID = "example-onboarding";

  const layerClient = new LayerClient({
    defaultStackOptions: {
      [STACK_ID]: { scope: { strategy: "serial" } },
    },
  });

  type StepPayload = { step: number; title: string };
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type StepState = LayerState<StepPayload, void>;
  type StepCall = LayerCallContext<StepPayload, void>;

  setLayerClient(layerClient);
  const client = useLayerClient();
  const onboardingStack = useStack({ stack: STACK_ID });

  const steps = [
    layerOptions<StepPayload, void>({
      stack: STACK_ID,
      key: ["example-onboarding", 1],
    }),
    layerOptions<StepPayload, void>({
      stack: STACK_ID,
      key: ["example-onboarding", 2],
    }),
    layerOptions<StepPayload, void>({
      stack: STACK_ID,
      key: ["example-onboarding", 3],
    }),
  ];

  const stepPayloads = [
    { step: 1, title: "Welcome" },
    { step: 2, title: "Choose preferences" },
    { step: 3, title: "You're all set" },
  ] as const;

  const stepHandles = steps.map((step) => createLayer(step));

  let started = false;
  const queued = writable(0);

  onMount(() => {
    const stack = stepHandles[0]!.stack;
    const sync = () => queued.set(stack.getQueuedSnapshot().length);
    sync();
    return stack.subscribe(sync);
  });

  function startOnboarding() {
    started = true;
    for (let i = 0; i < steps.length; i++) {
      void stepHandles[i]!.open(stepPayloads[i]);
    }
  }
</script>

{#each $onboardingStack as raw (raw.id)}
  {@const state = raw as StepState}
  {@const call = callFor(client, STACK_ID, raw) as StepCall | null}
  {#if call}
    <div role="dialog" aria-modal="true" aria-label="Step {state.payload.step}">
      <p>Step {state.payload.step} of 3</p>
      <h2>{state.payload.title}</h2>
      <button type="button" onclick={() => void call.end()}>
        {state.payload.step < 3 ? "Next" : "Finish"}
      </button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={startOnboarding}>Start onboarding</button>
  {#if started && $queued > 0}
    <span>Queued: {$queued}</span>
  {/if}
</div>
