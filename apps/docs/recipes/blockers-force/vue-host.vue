<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import EditDialog from "./vue.vue";

type ParentPayload = { title: string };
type ParentResponse = boolean;

const edit = layerOptions<ParentPayload, ParentResponse>({
  stack: "example-blockers-force",
  key: ["example-blockers-force", "parent"],
  component: EditDialog,
});

provideLayerClient();
const c = useLayer(edit);
const result = ref<boolean | null>(null);

async function openForm() {
  result.value = null;
  result.value = await c.open({ title: "Edit profile" });
}
</script>

<template>
  <StackOutlet stack="example-blockers-force" />
  <div>
    <button type="button" @click="openForm">Open form</button>
    <span v-if="result !== null">Result: {{ String(result) }}</span>
  </div>
</template>
