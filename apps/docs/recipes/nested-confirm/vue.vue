<script setup lang="ts">
import {
  isLayerCancelledError,
  layerOptions,
  useLayerGroup,
  type LayerComponentProps,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import ChildConfirm from "./vue-child.vue";

type ParentPayload = { title: string };
type ChildPayload = { title: string };
type ChildResponse = boolean;

const childConfirm = layerOptions<ChildPayload, ChildResponse>({
  key: ["example-nested", "child-confirm"],
  component: ChildConfirm,
});

const { call, payload } =
  defineProps<LayerComponentProps<ParentPayload, void>>();

// Owns a child stack scoped to this parent's lifetime; parent dismiss cancelAlls it.
const group = useLayerGroup(call);
const childResult = ref<boolean | null>(null);

async function openChild() {
  childResult.value = null;
  try {
    const ok = await group.open({
      ...childConfirm,
      payload: { title: "Really delete this item?" },
    });
    childResult.value = ok;
  } catch (error) {
    if (!isLayerCancelledError(error)) throw error;
  }
}
</script>

<template>
  <div role="dialog" aria-modal="true" :aria-label="payload.title">
    <h2>{{ payload.title }}</h2>
    <p>Remove this item from the list?</p>
    <div>
      <button type="button" @click="openChild">Delete item</button>
      <button type="button" @click="call.dismiss()">Close</button>
    </div>
    <span v-if="childResult !== null"
      >Child result: {{ String(childResult) }}</span
    >
    <group.Outlet />
  </div>
</template>
