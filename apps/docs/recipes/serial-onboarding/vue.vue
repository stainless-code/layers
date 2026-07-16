<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type StepPayload = { step: number; title: string };

const { call, payload } = defineProps<LayerComponentProps<StepPayload, void>>();
</script>

<template>
  <div role="dialog" aria-modal="true" :aria-label="`Step ${payload.step}`">
    <p>Step {{ payload.step }} of 3</p>
    <h2>{{ payload.title }}</h2>
    <button type="button" @click="call.end()">
      {{ payload.step < 3 ? "Next" : "Finish" }}
    </button>
  </div>
</template>
