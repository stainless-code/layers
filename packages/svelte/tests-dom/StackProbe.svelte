<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";

  import {
    createQueuedStack,
    setLayerClient,
    useStack,
  } from "../src/index";

  let { client }: { client: LayerClient } = $props();

  setLayerClient(client);

  const mounted = useStack(
    { stack: "default", select: (s) => s.length },
    client,
  );
  const queued = createQueuedStack(
    { stack: "default", select: (s) => s.length },
    client,
  );

  export const mountedLen = () => mounted.current;
  export const queuedLen = () => queued.current;
</script>

<span data-testid="mounted">{mounted.current}</span>
<span data-testid="queued">{queued.current}</span>
