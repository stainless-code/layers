<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";
  import { layerOptions } from "@stainless-code/layers";

  import { createLayer, setLayerClient, type WiredLayerHandle } from "../src/index";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (handles: {
      handleA: WiredLayerHandle<{ n: number }, boolean>;
      handleB: WiredLayerHandle<{ n: number }, boolean>;
    }) => void;
  } = $props();

  setLayerClient(client);

  const optsA = layerOptions<{ n: number }, boolean>({ key: ["a"] });
  const optsB = layerOptions<{ n: number }, boolean>({ key: ["b"] });

  const handleA = createLayer(optsA, client);
  const handleB = createLayer(optsB, client);
  onReady({ handleA, handleB });
</script>

<span data-testid="queued">{handleB.queued.length}</span>
