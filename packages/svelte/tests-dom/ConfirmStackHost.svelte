<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";

  import { setLayerClient, useStack } from "../src/index";
  import { saveOptions } from "./layers";

  let { client }: { client: LayerClient } = $props();

  setLayerClient(client);
  const stack = useStack("confirm");
</script>

{#each stack.current as s (s.id)}
  {@const call = stack.callFor(s)}
  {#if call}
    {@const Comp = saveOptions.component}
    <Comp
      {call}
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
