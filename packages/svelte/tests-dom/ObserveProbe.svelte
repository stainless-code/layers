<script lang="ts">
  import type { LayerClient, LayerKey } from "@stainless-code/layers";

  import {
    createLayerQueuedState,
    createLayerState,
    setLayerClient,
  } from "../src/index";

  let { client, dupKey }: { client: LayerClient; dupKey: LayerKey } = $props();

  setLayerClient(client);

  const mounted = createLayerState({
    key: dupKey,
    select: (states) => states.map((s) => (s.payload as { n: number }).n),
  });
  const queued = createLayerQueuedState({
    key: dupKey,
    select: (states) => states.length,
  });
</script>

<div>
  <span data-testid="mounted">{mounted.current.join(",")}</span>
  <span data-testid="queued">{queued.current}</span>
</div>
