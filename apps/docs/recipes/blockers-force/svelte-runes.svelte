<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    layerOptions,
    useLayerGroup,
    type LayerComponentProps,
  } from "@stainless-code/svelte-layers";

  type ParentPayload = { title: string };
  type ParentResponse = boolean;
  type DiscardPayload = { title: string; message: string };
  type DiscardResponse = boolean;
  // `useLayerGroup` exposes a heterogeneous child stack — pin the concrete
  // child layer types at the outlet.
  type DiscardState = LayerState<DiscardPayload, DiscardResponse>;
  type DiscardCall = LayerCallContext<DiscardPayload, DiscardResponse>;

  let {
    call,
    payload,
    dismissing,
  }: LayerComponentProps<ParentPayload, ParentResponse> = $props();

  // svelte-ignore state_referenced_locally
  const group = useLayerGroup(call, { name: "discard" });
  let text = $state("");

  const discardConfirm = layerOptions<DiscardPayload, DiscardResponse>({
    key: ["example-blockers-force", "discard"],
  });

  $effect(() => {
    return call.addBlocker(() => text.length === 0);
  });

  async function attemptClose() {
    if (text.length === 0) {
      call.end(false);
      return;
    }
    const discard = await group.open({
      ...discardConfirm,
      payload: {
        title: "Discard changes?",
        message: "You'll lose your unsaved edits.",
      },
    });
    if (discard) call.end(false, { force: true });
  }
</script>

<!--
App.svelte — host wiring:
  setLayerClient();
  const parentStack = useStack({ stack: "example-blockers-force" });
  const edit = layerOptions({ stack: "example-blockers-force", key: ["example-blockers-force", "parent"], component: EditDialog });
  const c = createLayer(edit);
  {#each parentStack.current as state (state.id)}
    {@const call = parentStack.callFor(state)}
    {#if call}<EditDialog {call} payload={state.payload} dismissing={state.dismissing} />{/if}
  {/each}
  <button onclick={() => c.open({ title: "Edit profile" })}>Open form</button>
-->

<div role="dialog" aria-modal="true" aria-label={payload.title}>
  <h2>{payload.title}</h2>
  <input
    type="text"
    bind:value={text}
    placeholder="Type to make the form dirty…"
  />
  {#if dismissing}
    <p>blocker consulted → vetoed</p>
  {/if}
  <button type="button" onclick={attemptClose}>Close</button>
  <button type="button" onclick={() => call.end(true, { force: true })}>
    Force close
  </button>
  {#each group.stack.current as raw (raw.id)}
    {@const s = raw as DiscardState}
    {@const childCall = group.stack.callFor(raw) as DiscardCall | null}
    {#if childCall}
      <div role="alertdialog" aria-modal="true">
        <h3>{s.payload.title}</h3>
        <p>{s.payload.message}</p>
        <button type="button" onclick={() => void childCall.end(false)}>
          Cancel
        </button>
        <button type="button" onclick={() => void childCall.end(true)}>
          Discard
        </button>
      </div>
    {/if}
  {/each}
</div>
