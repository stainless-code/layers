<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";
import { onMounted, onUnmounted } from "vue";

type ToastPayload = { message: string };

const { call, payload } =
  defineProps<LayerComponentProps<ToastPayload, void>>();

let timer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  timer = setTimeout(() => void call.dismiss(), 2500);
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div role="status" aria-live="polite">
    <span>{{ payload.message }}</span>
    <button type="button" aria-label="Dismiss" @click="call.dismiss()">
      ×
    </button>
  </div>
</template>
