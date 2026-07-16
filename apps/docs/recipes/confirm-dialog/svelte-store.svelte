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

  type ConfirmPayload = { title: string };
  type ConfirmResponse = boolean;
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type ConfirmState = LayerState<ConfirmPayload, ConfirmResponse>;
  type ConfirmCall = LayerCallContext<ConfirmPayload, ConfirmResponse>;

  setLayerClient();
  const client = useLayerClient();
  const confirmStack = useStack({ stack: "example-confirm" });

  const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
    stack: "example-confirm",
    key: ["example-confirm"],
  });

  const c = createLayer(confirm);

  let result: boolean | null = null;

  async function deleteFile() {
    result = null;
    const ok = await c.open({ title: "Delete this file?" });
    result = ok;
  }
</script>

{#each $confirmStack as raw (raw.id)}
  {@const state = raw as ConfirmState}
  {@const call = callFor(client, "example-confirm", raw) as ConfirmCall | null}
  {#if call}
    <div role="dialog" aria-modal="true">
      <h2>{state.payload.title}</h2>
      <button type="button" onclick={() => void call.end(false)}>No</button>
      <button type="button" onclick={() => void call.end(true)}>Yes</button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={deleteFile}>Delete file</button>
  {#if result !== null}
    <span>Result: {String(result)}</span>
  {/if}
</div>
