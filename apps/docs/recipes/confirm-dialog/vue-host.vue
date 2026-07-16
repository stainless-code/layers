<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import ConfirmDialog from "./vue.vue";

const confirm = layerOptions<{ title: string }, boolean>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ConfirmDialog,
});

provideLayerClient();
const client = useLayerClient();
const result = ref<boolean | null>(null);

async function deleteFile() {
  result.value = null;
  const ok = await client.open({
    ...confirm,
    payload: { title: "Delete this file?" },
  });
  result.value = ok;
}
</script>

<template>
  <StackOutlet stack="example-confirm" />
  <div>
    <button type="button" @click="deleteFile">Delete file</button>
    <span v-if="result !== null">Result: {{ String(result) }}</span>
  </div>
</template>
