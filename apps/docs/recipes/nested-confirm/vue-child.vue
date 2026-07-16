<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type ChildPayload = { title: string };
type ChildResponse = boolean;

const { call, payload } =
  defineProps<LayerComponentProps<ChildPayload, ChildResponse>>();
</script>

<template>
  <div role="dialog" aria-modal="true">
    <h3>{{ payload.title }}</h3>
    <div>
      <button type="button" @click="() => void call.end(false)">No</button>
      <button type="button" @click="() => void call.end(true)">Yes</button>
    </div>
  </div>
</template>
