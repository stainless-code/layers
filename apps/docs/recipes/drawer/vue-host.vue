<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import Drawer from "./vue.vue";

type DrawerPayload = { title: string };

const drawer = layerOptions<DrawerPayload, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: Drawer,
});

provideLayerClient();
const c = useLayer(drawer);
const result = ref<boolean | null>(null);

async function openDrawer() {
  result.value = null;
  const saved = await c.open({ title: "Settings" });
  result.value = saved;
}
</script>

<template>
  <StackOutlet stack="example-drawer" />
  <div>
    <button type="button" @click="openDrawer">Open drawer</button>
    <span v-if="result !== null">Result: {{ String(result) }}</span>
  </div>
</template>
