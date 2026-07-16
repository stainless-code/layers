<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";

import ParentDialog from "./vue.vue";

type ParentPayload = { title: string };

const parentDialog = layerOptions<ParentPayload, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialog,
});

provideLayerClient();
const c = useLayer(parentDialog);

function openParent() {
  void c.open({ title: "Edit item" });
}
</script>

<template>
  <StackOutlet stack="example-nested" />
  <button type="button" @click="openParent">Open parent dialog</button>
</template>
