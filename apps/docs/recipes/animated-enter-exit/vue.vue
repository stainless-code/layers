<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";
import { ref, watch } from "vue";

type AnimatedPayload = { title: string };

const { call, payload, transition } =
  defineProps<LayerComponentProps<AnimatedPayload, void>>();

const visible = ref(false);

watch(
  () => transition,
  (phase) => {
    if (phase === "entering") {
      requestAnimationFrame(() => {
        visible.value = true;
      });
    } else if (phase === "settled") {
      visible.value = true;
    } else if (phase === "exiting") {
      visible.value = false;
    }
  },
  { immediate: true },
);

function onTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== "opacity") return;
  if (transition === "entering" || transition === "exiting") {
    call.settle();
  }
}
</script>

<template>
  <div
    class="backdrop"
    :class="{ 'is-visible': visible }"
    aria-hidden="true"
    @transitionend="onTransitionEnd"
  />
  <div
    role="dialog"
    aria-modal="true"
    class="dialog"
    :class="{ 'is-visible': visible }"
    @transitionend="onTransitionEnd"
  >
    <h2>{{ payload.title }}</h2>
    <p>Watch the enter and exit animation. Close to see the exit transition.</p>
    <div class="actions">
      <button type="button" class="close" @click="() => void call.dismiss()">
        Close
      </button>
    </div>
    <p class="phase">transition: {{ transition }}</p>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 200ms ease;
  z-index: 9998;
}

.dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, calc(-50% + 12px));
  opacity: 0;
  transition:
    opacity 200ms ease,
    transform 200ms ease;
  background: var(--blume-background, #faf8f5);
  color: var(--blume-foreground, #1c1b19);
  border: 1px solid var(--blume-border, #e2ddd6);
  border-radius: var(--blume-radius, 12px);
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  min-width: 320px;
}

.is-visible {
  opacity: 1;
}

.dialog.is-visible {
  transform: translate(-50%, -50%);
}

h2 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--blume-foreground, #1c1b19);
}

p {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--blume-muted-foreground, #6b6863);
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.close {
  background: transparent;
  color: var(--blume-foreground, #1c1b19);
  border: 1px solid var(--blume-border, #e2ddd6);
  border-radius: var(--blume-radius, 8px);
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

.phase {
  margin: 16px 0 0;
  font-size: 12px;
  font-family: var(--blume-font-mono, ui-monospace, monospace);
  color: var(--blume-muted-foreground, #6b6863);
}
</style>
