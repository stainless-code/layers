<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    callFor,
    createLayer,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  type DrawerPayload = { title: string };
  type DrawerResponse = boolean;
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type DrawerState = LayerState<DrawerPayload, DrawerResponse>;
  type DrawerCall = LayerCallContext<DrawerPayload, DrawerResponse>;

  setLayerClient();
  const client = useLayerClient();
  const drawerStack = useStack({ stack: "example-drawer" });

  const drawer = layerOptions<DrawerPayload, DrawerResponse>({
    stack: "example-drawer",
    key: ["example-drawer"],
  });

  const c = createLayer(drawer);

  let result: boolean | null = null;

  async function openDrawer() {
    result = null;
    const saved = await c.open({ title: "Settings" });
    result = saved;
  }
</script>

{#each $drawerStack as raw (raw.id)}
  {@const state = raw as DrawerState}
  {@const call = callFor(client, "example-drawer", raw) as DrawerCall | null}
  {#if call}
    <div aria-hidden="true" onclick={() => void call.end(false)}></div>
    <div role="dialog" aria-modal="true">
      <h2>{state.payload.title}</h2>
      <p>Edit your settings here. Save or cancel to close the drawer.</p>
      <button type="button" onclick={() => void call.end(false)}>Cancel</button>
      <button type="button" onclick={() => void call.end(true)}>Save</button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={openDrawer}>Open drawer</button>
  {#if result !== null}
    <span>Result: {String(result)}</span>
  {/if}
</div>
