<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type DiscardPayload = { title: string; message: string };
type DiscardResponse = boolean;

const { call, payload } =
  defineProps<LayerComponentProps<DiscardPayload, DiscardResponse>>();
</script>

<template>
  <div role="alertdialog" aria-modal="true">
    <h3>{{ payload.title }}</h3>
    <p>{{ payload.message }}</p>
    <div>
      <button type="button" @click="() => void call.end(false)">Cancel</button>
      <button type="button" @click="() => void call.end(true)">Discard</button>
    </div>
  </div>
</template>
