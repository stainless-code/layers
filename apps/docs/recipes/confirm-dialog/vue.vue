<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

const { call, payload } =
  defineProps<LayerComponentProps<{ title: string }, boolean>>();
</script>

<template>
  <div role="dialog" aria-modal="true">
    <h2>{{ payload.title }}</h2>
    <div>
      <button type="button" @click="call.end(false)">No</button>
      <button type="button" @click="call.end(true)">Yes</button>
    </div>
  </div>
</template>
