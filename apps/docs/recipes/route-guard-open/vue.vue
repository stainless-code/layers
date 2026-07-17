<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type GuardPayload = { destination: string };
type GuardResult = boolean;

const { call, payload } =
  defineProps<LayerComponentProps<GuardPayload, GuardResult>>();
</script>

<template>
  <div role="dialog" aria-modal="true">
    <h2>Leave this page?</h2>
    <p>
      Unsaved changes may be lost. Navigate to
      <strong>{{ payload.destination }}</strong
      >?
    </p>
    <div>
      <button type="button" @click="void call.end(false)">Stay</button>
      <button type="button" @click="void call.end(true)">Leave</button>
    </div>
  </div>
</template>
