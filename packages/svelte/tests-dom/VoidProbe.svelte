<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";
  import { layerOptions } from "@stainless-code/layers";

  import {
    createLayer,
    setLayerClient,
    type WiredLayerHandle,
  } from "../src/index";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (handle: WiredLayerHandle<void, boolean>) => void;
  } = $props();

  setLayerClient(client);

  const voidOptions = layerOptions<void, boolean>({
    key: ["void"],
    exitingDelay: 0,
  });

  const handle = createLayer(voidOptions, client);
  onReady(handle);
</script>
