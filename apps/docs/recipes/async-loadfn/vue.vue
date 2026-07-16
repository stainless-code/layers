<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

interface Profile {
  name: string;
  role: string;
  initials: string;
}

type ProfilePayload = { userId: string };
type ProfileResult = void;

const { call, payload, data, phase } =
  defineProps<
    LayerComponentProps<ProfilePayload, ProfileResult, never, Profile>
  >();
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    :aria-label="`Profile ${payload.userId}`"
  >
    <p v-if="phase === 'pending'">Loading profile…</p>
    <div v-else>
      <h2>{{ data?.name }}</h2>
      <p>{{ data?.role }}</p>
      <span>{{ data?.initials }}</span>
    </div>
    <button type="button" @click="void call.dismiss()">Close</button>
  </div>
</template>
