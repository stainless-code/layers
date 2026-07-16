<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import Toast from "./vue.vue";

type ToastPayload = { message: string };

const toast = layerOptions<ToastPayload, void>({
  stack: "example-toast",
  key: ["example-toast"],
  component: Toast,
});

provideLayerClient();
const client = useLayerClient();
const fired = ref(false);

function showToast() {
  void client.open({ ...toast, payload: { message: "Changes saved" } });
  fired.value = true;
}
</script>

<template>
  <StackOutlet stack="example-toast" />
  <div>
    <button type="button" @click="showToast">Show toast</button>
    <span v-if="fired">Toast fired</span>
  </div>
</template>
