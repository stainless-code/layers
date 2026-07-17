<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayer,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import ProgressOverlay from "./vue.vue";

type ProgressPayload = { percent: number; label: string };

const progress = layerOptions<ProgressPayload, void>({
  stack: "example-progress",
  key: ["example-progress"],
  component: ProgressOverlay,
});

provideLayerClient();
const c = useLayer(progress);
const status = ref<"idle" | "running" | "complete">("idle");

function startUpload() {
  status.value = "running";
  void c.open({ percent: 0, label: "Uploading file…" });
  const layer = c.stack.find(["example-progress"]);
  if (!layer) {
    status.value = "idle";
    return;
  }

  let percent = 0;
  const interval = setInterval(() => {
    percent = Math.min(100, percent + 5);
    c.stack.update(layer, { percent });
    if (percent >= 100) {
      clearInterval(interval);
      void c.stack.dismiss(layer, undefined as void).then(() => {
        status.value = "complete";
      });
    }
  }, 150);
}
</script>

<template>
  <StackOutlet stack="example-progress" />
  <div>
    <button type="button" :disabled="status === 'running'" @click="startUpload">
      Start upload
    </button>
    <span v-if="status !== 'idle'">
      {{ status === "running" ? "Uploading…" : "Complete" }}
    </span>
  </div>
</template>
