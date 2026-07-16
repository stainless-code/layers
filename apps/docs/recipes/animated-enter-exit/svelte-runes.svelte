<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  type AnimatedPayload = { title: string };
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type AnimatedState = LayerState<AnimatedPayload, void>;
  type AnimatedCall = LayerCallContext<AnimatedPayload, void>;

  const EXIT_MS = 200;

  setLayerClient();
  const client = useLayerClient();
  const animatedStack = useStack("example-animated");

  const animated = layerOptions<AnimatedPayload, void>({
    stack: "example-animated",
    key: ["example-animated"],
    enteringDelay: EXIT_MS,
    exitingDelay: EXIT_MS,
  });

  let status = $state<"idle" | "open" | "closed">("idle");

  $effect(() => {
    const state = animatedStack.current[0];
    if (!state) return;
    const call = animatedStack.callFor(state);
    if (!call) return;
    const transition = state.transition;
    if (transition === "entering" || transition === "exiting") {
      const id = setTimeout(() => void call.settle(), EXIT_MS);
      return () => clearTimeout(id);
    }
  });

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

{#each animatedStack.current as raw (raw.id)}
  {@const state = raw as AnimatedState}
  {@const call = animatedStack.callFor(raw) as AnimatedCall | null}
  {#if call}
    <div role="dialog" aria-modal="true">
      <h2>{state.payload.title}</h2>
      <p>Watch the enter and exit animation. Close to see the exit transition.</p>
      <button type="button" onclick={() => void call.dismiss()}>Close</button>
      <p>transition: {state.transition}</p>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={openDialog}>Open animated dialog</button>
  {#if status !== "idle"}
    <span>{status === "open" ? "Open" : "Closed (exit animated)"}</span>
  {/if}
</div>
