<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    createLayer,
    layerOptions,
    setLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  type DrawerPayload = { title: string };
  type DrawerResponse = boolean;
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type DrawerState = LayerState<DrawerPayload, DrawerResponse>;
  type DrawerCall = LayerCallContext<DrawerPayload, DrawerResponse>;

  setLayerClient();
  const drawerStack = useStack({ stack: "example-drawer" });

  const drawer = layerOptions<DrawerPayload, DrawerResponse>({
    stack: "example-drawer",
    key: ["example-drawer"],
  });

  const c = createLayer(drawer);

  let result = $state<boolean | null>(null);

  async function openDrawer() {
    result = null;
    const saved = await c.open({ title: "Settings" });
    result = saved;
  }
</script>

{#each drawerStack.current as raw (raw.id)}
  {@const state = raw as DrawerState}
  {@const call = drawerStack.callFor(raw) as DrawerCall | null}
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
