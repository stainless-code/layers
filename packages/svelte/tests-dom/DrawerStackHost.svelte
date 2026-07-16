<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";

  import { setLayerClient, useStack } from "../src/index";
  import { parentOptions } from "./layers";

  let { client }: { client: LayerClient } = $props();

  setLayerClient(client);
  const stack = useStack({ stack: "drawer" });
</script>

{#each stack.current as s (s.id)}
  {@const call = stack.callFor(s)}
  {#if call}
    {@const Comp = parentOptions.component}
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
