<script setup lang="ts">
import type { LayerComponentProps } from "@stainless-code/vue-layers";

type DrawerPayload = { title: string };

const { call, payload } =
  defineProps<LayerComponentProps<DrawerPayload, boolean>>();
</script>

<template>
  <div
    aria-hidden="true"
    style="
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 9998;
    "
    @click="call.end(false)"
  />
  <div
    role="dialog"
    aria-modal="true"
    style="
      position: fixed;
      top: 0;
      right: 0;
      height: 100%;
      width: min(360px, 90vw);
      padding: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
    "
  >
    <h2>{{ payload.title }}</h2>
    <p style="flex: 1">
      Edit your settings here. Save or cancel to close the drawer.
    </p>
    <div style="display: flex; gap: 8px; justify-content: flex-end">
      <button type="button" @click="call.end(false)">Cancel</button>
      <button type="button" @click="call.end(true)">Save</button>
    </div>
  </div>
</template>
