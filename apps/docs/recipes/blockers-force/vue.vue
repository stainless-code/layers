<script setup lang="ts">
import {
  layerOptions,
  useLayerGroup,
  type LayerComponentProps,
} from "@stainless-code/vue-layers";
import { ref, watchEffect } from "vue";

import DiscardConfirm from "./vue-discard.vue";

type ParentPayload = { title: string };
type ParentResponse = boolean;
type DiscardPayload = { title: string; message: string };
type DiscardResponse = boolean;

const discardConfirm = layerOptions<DiscardPayload, DiscardResponse>({
  key: ["example-blockers-force", "discard"],
  component: DiscardConfirm,
});

const { call, payload, dismissing } =
  defineProps<LayerComponentProps<ParentPayload, ParentResponse>>();

const group = useLayerGroup(call, { name: "discard" });
const text = ref("");

watchEffect((onCleanup) => {
  onCleanup(call.addBlocker(() => text.value.length === 0));
});

async function attemptClose() {
  if (text.value.length === 0) {
    call.end(false);
    return;
  }
  const discard = await group.open({
    ...discardConfirm,
    payload: {
      title: "Discard changes?",
      message: "You'll lose your unsaved edits.",
    },
  });
  if (discard) call.end(false, { force: true });
}
</script>

<template>
  <div role="dialog" aria-modal="true" :aria-label="payload.title">
    <h2>{{ payload.title }}</h2>
    <input
      v-model="text"
      type="text"
      placeholder="Type to make the form dirty…"
    />
    <p v-if="dismissing">blocker consulted → vetoed</p>
    <div>
      <button type="button" @click="attemptClose">Close</button>
      <button type="button" @click="() => void call.end(true, { force: true })">
        Force close
      </button>
    </div>
    <group.Outlet />
  </div>
</template>
