<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import AnimatedDialog from "./vue.vue";

type AnimatedPayload = { title: string };

const EXIT_MS = 200;

const animated = layerOptions<AnimatedPayload, void>({
  stack: "example-animated",
  key: ["example-animated"],
  component: AnimatedDialog,
  enteringDelay: EXIT_MS,
  exitingDelay: EXIT_MS,
});

provideLayerClient();
const c = useLayer(animated);
const status = ref<"idle" | "open" | "closed">("idle");

function openDialog() {
  status.value = "open";
  void c
    .open({
      title: "Animated dialog",
    })
    .then(() => {
      status.value = "closed";
    });
}
</script>

<template>
  <StackOutlet stack="example-animated" />
  <div class="trigger">
    <button type="button" class="open" @click="openDialog">
      Open animated dialog
    </button>
    <span v-if="status !== 'idle'" class="status">
      {{ status === "open" ? "Open" : "Closed (exit animated)" }}
    </span>
  </div>
</template>

<style scoped>
.trigger {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.open {
  background: var(--blume-accent, #0d9488);
  color: var(--blume-accent-foreground, #fff);
  border: none;
  border-radius: var(--blume-radius, 8px);
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 150ms;
}

.open:hover {
  opacity: 0.9;
}

.status {
  display: inline-block;
  background: var(--blume-muted, #f0ede8);
  color: var(--blume-foreground, #1c1b19);
  border-radius: var(--blume-radius, 6px);
  padding: 4px 12px;
  font-family: var(--blume-font-mono, ui-monospace, monospace);
  font-size: 14px;
}
</style>
