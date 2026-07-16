<script setup lang="ts">
import {
  LayerClient,
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";
import { onMounted, onUnmounted, ref } from "vue";

import OnboardingStep from "./vue.vue";

const STACK_ID = "example-onboarding";

// A serial stack: opens play one at a time; later opens queue.
const layerClient = new LayerClient({
  defaultStackOptions: {
    [STACK_ID]: { scope: { strategy: "serial" } },
  },
});

type StepPayload = { step: number; title: string };

// Register one layer per step on the same serial stack (distinct keys).
const steps = [
  layerOptions<StepPayload, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 1],
    component: OnboardingStep,
  }),
  layerOptions<StepPayload, void>({
    stack: STACK_ID,
    key: ["example-onboarding", 2],
    component: OnboardingStep,
  }),
  layerOptions<StepPayload, void>({
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

provideLayerClient(layerClient);
const stepHandles = steps.map((step) => useLayer(step));
const started = ref(false);
const queued = ref(0);

onMounted(() => {
  const stack = stepHandles[0]!.stack;
  const sync = () => {
    queued.value = stack.getQueuedSnapshot().length;
  };
  sync();
  const unsub = stack.subscribe(sync);
  onUnmounted(unsub);
});

// Open all steps up front — the serial queue plays them in order.
function startOnboarding() {
  started.value = true;
  for (let i = 0; i < steps.length; i++) {
    void stepHandles[i]!.open(stepPayloads[i]);
  }
}
</script>

<template>
  <StackOutlet :stack="STACK_ID" />
  <div>
    <button type="button" @click="startOnboarding">Start onboarding</button>
    <span v-if="started && queued > 0">Queued: {{ queued }}</span>
  </div>
</template>
