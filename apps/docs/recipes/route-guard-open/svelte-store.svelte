<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    LayerClient,
    callFor,
    layerOptions,
    setLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  type GuardPayload = { destination: string };
  type GuardResponse = boolean;
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type GuardState = LayerState<GuardPayload, GuardResponse>;
  type GuardCall = LayerCallContext<GuardPayload, GuardResponse>;

  const layerClient = new LayerClient();

  setLayerClient(layerClient);
  const guardStack = useStack({ stack: "example-route-guard" });

  const guard = layerOptions<GuardPayload, GuardResponse>({
    stack: "example-route-guard",
    key: ["example-route-guard"],
  });

  async function simulateNavigation(destination: string): Promise<string> {
    const ok = await layerClient.open({
      ...guard,
      payload: { destination },
    });
    return ok ? `Navigated to ${destination}` : "Navigation cancelled";
  }

  let result: string | null = null;

  async function navigate() {
    result = null;
    result = await simulateNavigation("/settings");
  }
</script>

{#each $guardStack as raw (raw.id)}
  {@const state = raw as GuardState}
  {@const call = callFor(layerClient, "example-route-guard", raw) as GuardCall | null}
  {#if call}
    <div role="dialog" aria-modal="true">
      <h2>Leave this page?</h2>
      <p>
        Unsaved changes may be lost. Navigate to <strong>{state.payload.destination}</strong>?
      </p>
      <button type="button" onclick={() => void call.end(false)}>Stay</button>
      <button type="button" onclick={() => void call.end(true)}>Leave</button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={navigate}>Simulate navigation</button>
  {#if result !== null}
    <span>Result: {result}</span>
  {/if}
</div>
