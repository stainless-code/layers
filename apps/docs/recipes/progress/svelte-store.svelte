<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    callFor,
    createLayer,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  type ProgressPayload = { percent: number; label: string };
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type ProgressState = LayerState<ProgressPayload, void>;
  type ProgressCall = LayerCallContext<ProgressPayload, void>;

  setLayerClient();
  const client = useLayerClient();
  const progressStack = useStack({ stack: "example-progress" });

  const progress = layerOptions<ProgressPayload, void>({
    stack: "example-progress",
    key: ["example-progress"],
  });

  const c = createLayer(progress);

  let status: "idle" | "running" | "complete" = "idle";

  function startUpload() {
    status = "running";
    void c.open({ percent: 0, label: "Uploading file…" });
    const layer = c.stack.find(["example-progress"]);
    if (!layer) {
      status = "idle";
      return;
    }

    let percent = 0;
    const interval = setInterval(() => {
      percent = Math.min(100, percent + 5);
      c.stack.update(layer, { percent });
      if (percent >= 100) {
        clearInterval(interval);
        void c.stack.dismiss(layer, undefined as void).then(() => {
          status = "complete";
        });
      }
    }, 150);
  }
</script>

{#each $progressStack as raw (raw.id)}
  {@const state = raw as ProgressState}
  {@const call = callFor(client, "example-progress", raw) as ProgressCall | null}
  {#if call}
    <div role="dialog" aria-modal="true" aria-label={state.payload.label}>
      <p>{state.payload.label}</p>
      <progress value={state.payload.percent} max="100"></progress>
      <p>{state.payload.percent}%</p>
    </div>
  {/if}
{/each}

<div>
  <button type="button" disabled={status === "running"} onclick={startUpload}>
    Start upload
  </button>
  {#if status !== "idle"}
    <span>{status === "running" ? "Uploading…" : "Complete"}</span>
  {/if}
</div>
