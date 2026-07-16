<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";

  import { callFor, setLayerClient, useStack } from "../src/store";
  import { storeSaveOptions } from "./layers";

  let { client }: { client: LayerClient } = $props();

  setLayerClient(client);
  const stack = useStack({ stack: "confirm" });
</script>

{#each $stack as s (s.id)}
  {@const layerCall = callFor(client, "confirm", s)}
  {#if layerCall}
    {@const Comp = storeSaveOptions.component}
    <Comp
      call={layerCall}
      payload={s.payload}
      data={s.data}
      error={s.error}
      phase={s.phase}
      transition={s.transition}
      actionStatus={s.actionStatus}
      dismissing={s.dismissing}
    />
  {/if}
{/each}
