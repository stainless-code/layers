<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    callFor,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  type AnimatedPayload = { title: string };
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type AnimatedState = LayerState<AnimatedPayload, void>;
  type AnimatedCall = LayerCallContext<AnimatedPayload, void>;

  const EXIT_MS = 200;

  setLayerClient();
  const client = useLayerClient();
  const animatedStack = useStack({ stack: "example-animated" });

  const animated = layerOptions<AnimatedPayload, void>({
    stack: "example-animated",
    key: ["example-animated"],
    enteringDelay: EXIT_MS,
    exitingDelay: EXIT_MS,
  });

  let status: "idle" | "open" | "closed" = "idle";
  let lastTransition: string | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  $: state = $animatedStack[0];
  $: if (state) {
    const transition = state.transition;
    if (transition !== lastTransition) {
      lastTransition = transition;
      if (settleTimer) clearTimeout(settleTimer);
      if (transition === "entering" || transition === "exiting") {
        const call = callFor(client, "example-animated", state);
        if (call) {
          settleTimer = setTimeout(() => void call.settle(), EXIT_MS);
        }
      }
    }
  }

  function openDialog() {
    status = "open";
    void client
      .open({
        ...animated,
        payload: { title: "Animated dialog" },
      })
      .then(() => {
        status = "closed";
      });
  }
</script>

{#each $animatedStack as raw (raw.id)}
  {@const state = raw as AnimatedState}
  {@const call = callFor(client, "example-animated", raw) as AnimatedCall | null}
  {#if call}
    <div role="dialog" aria-modal="true">
      <h2>{state.payload.title}</h2>
      <p>Watch the enter and exit animation. Close to see the exit transition.</p>
      <button type="button" on:click={() => void call.dismiss()}>Close</button>
      <p>transition: {state.transition}</p>
    </div>
  {/if}
{/each}

<div>
  <button type="button" on:click={openDialog}>Open animated dialog</button>
  {#if status !== "idle"}
    <span>{status === "open" ? "Open" : "Closed (exit animated)"}</span>
  {/if}
</div>
