<script setup lang="ts">
import {
  LayerClient,
  layerOptions,
  provideLayerClient,
  StackOutlet,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import RouteGuard from "./vue.vue";

type GuardPayload = { destination: string };
type GuardResult = boolean;

const layerClient = new LayerClient();

const guard = layerOptions<GuardPayload, GuardResult>({
  stack: "example-route-guard",
  key: ["example-route-guard"],
  component: RouteGuard,
});

async function navigate(destination: string): Promise<string> {
  const ok = await layerClient.open({
    ...guard,
    payload: { destination },
  });
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

provideLayerClient(layerClient);
const result = ref<string | null>(null);

async function onNavigate() {
  result.value = null;
  result.value = await navigate("/settings");
}
</script>

<template>
  <StackOutlet stack="example-route-guard" />
  <div>
    <button type="button" @click="onNavigate">Simulate navigation</button>
    <span v-if="result !== null">Result: {{ result }}</span>
  </div>
</template>
