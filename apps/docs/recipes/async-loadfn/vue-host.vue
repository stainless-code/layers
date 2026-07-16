<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/vue-layers";
import { ref } from "vue";

import ProfileDialog from "./vue.vue";

interface Profile {
  name: string;
  role: string;
  initials: string;
}

type ProfilePayload = { userId: string };
type ProfileResult = void;

const profile = layerOptions<ProfilePayload, ProfileResult, never, Profile>({
  stack: "example-async-loadfn",
  key: ["example-async-loadfn"],
  component: ProfileDialog,
  loadFn: async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      name: "Ada Lovelace",
      role: "Founding Engineer",
      initials: "AL",
    };
  },
});

provideLayerClient();
const client = useLayerClient();
const phase = ref<"idle" | "loading" | "done">("idle");

async function openProfile() {
  phase.value = "loading";
  await client.open({ ...profile, payload: { userId: "ada" } });
  phase.value = "done";
}
</script>

<template>
  <StackOutlet stack="example-async-loadfn" />
  <div>
    <button type="button" @click="openProfile">Open async dialog</button>
    <span v-if="phase !== 'idle'">{{
      phase === "loading" ? "Loading…" : "Closed"
    }}</span>
  </div>
</template>
