<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";
  import { layerOptions } from "@stainless-code/layers";

  import {
    createLayer,
    setLayerClient,
    type WiredLayerStoreHandle,
  } from "../src/store";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (handle: WiredLayerStoreHandle<{ msg: string }, void>) => void;
  } = $props();

  setLayerClient(client);

  const toastOptions = layerOptions<{ msg: string }, void>({
    key: ["toast"],
    component: undefined,
    exitingDelay: 0,
  });

  const handle = createLayer(toastOptions, client);
  const { state, queued, top } = handle;
  onReady(handle);
</script>

<div>
  <span data-testid="state-len">{$state.length}</span>
  <span data-testid="queued-len">{$queued.length}</span>
  <span data-testid="top-msg">{$top?.payload.msg ?? "none"}</span>
  <span data-testid="current-id">{handle.current?.id ?? "none"}</span>
</div>
