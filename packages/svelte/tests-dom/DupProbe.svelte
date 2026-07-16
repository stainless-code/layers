<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";

  import { createLayer, setLayerClient, type WiredLayerHandle } from "../src/index";
  import { dupOptions } from "./layers-handles";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (
      handles: [
        WiredLayerHandle<{ n: number }, boolean>,
        WiredLayerHandle<{ n: number }, boolean>,
      ],
    ) => void;
  } = $props();

  setLayerClient(client);

  const a = createLayer(dupOptions, client);
  const b = createLayer(dupOptions, client);
  onReady([a, b]);
</script>

<div>
  <span data-testid="a-len">{a.state.length}</span>
  <span data-testid="b-len">{b.state.length}</span>
</div>
