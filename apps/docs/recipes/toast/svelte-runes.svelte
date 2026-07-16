<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    createLayer,
    layerOptions,
    setLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  type ToastPayload = { message: string };
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type ToastState = LayerState<ToastPayload, void>;
  type ToastCall = LayerCallContext<ToastPayload, void>;

  setLayerClient();
  const toastStack = useStack({ stack: "example-toast" });

  const toast = layerOptions<ToastPayload, void>({
    stack: "example-toast",
    key: ["example-toast"],
  });

  const c = createLayer(toast);

  let fired = $state(false);

  function showToast() {
    void c.open({ message: "Changes saved" });
    fired = true;
  }

  function autoDismiss(
    _node: HTMLElement,
    call: ToastCall,
  ) {
    const timer = setTimeout(() => void call.dismiss(), 2500);
    return {
      destroy() {
        clearTimeout(timer);
      },
    };
  }
</script>

{#each toastStack.current as raw (raw.id)}
  {@const state = raw as ToastState}
  {@const call = toastStack.callFor(raw) as ToastCall | null}
  {#if call}
    <div use:autoDismiss={call} role="status" aria-live="polite">
      <span>{state.payload.message}</span>
      <button
        type="button"
        onclick={() => void call.dismiss()}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={showToast}>Show toast</button>
  {#if fired}
    <span>Toast fired</span>
  {/if}
</div>
