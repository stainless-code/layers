<script lang="ts">
  import type { LayerClient } from "@stainless-code/layers";
  import { layerOptions } from "@stainless-code/layers";

  import {
    createLayer,
    createLayerQueuedState,
    createLayerState,
    createQueuedStack,
    setLayerClient,
    useStack,
    type WiredLayerHandle,
  } from "../src/index";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (handle: WiredLayerHandle<{ msg: string }, void>) => void;
  } = $props();

  setLayerClient(client);

  const toastOptions = layerOptions<{ msg: string }, void>({
    key: ["toast"],
    component: undefined,
    exitingDelay: 0,
  });

  const handle = createLayer(toastOptions, client);
  onReady(handle);
</script>

<div>
  <span data-testid="state-len">{handle.state.length}</span>
  <span data-testid="queued-len">{handle.queued.length}</span>
  <span data-testid="top-msg">{handle.top?.payload.msg ?? "none"}</span>
  <span data-testid="current-id">{handle.current?.id ?? "none"}</span>
</div>
