<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type ProgressPayload = { percent: number; label: string };

const { payload } = defineProps<LayerComponentProps<ProgressPayload, void>>();
</script>

<template>
  <div role="dialog" aria-modal="true" :aria-label="payload.label">
    <p>{{ payload.label }}</p>
    <progress :value="payload.percent" max="100" />
    <p>{{ payload.percent }}%</p>
  </div>
</template>
