<script setup lang="ts">
import {
  LayerClient,
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
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

provideLayerClient(layerClient);
const c = useLayer(guard);
const result = ref<string | null>(null);

async function navigate(destination: string): Promise<string> {
  const ok = await c.open({ destination });
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

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
