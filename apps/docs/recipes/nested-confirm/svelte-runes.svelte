<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    layerOptions,
    useLayerGroup,
    type LayerComponentProps,
  } from "@stainless-code/svelte-layers";
  import { isLayerCancelledError } from "@stainless-code/layers";

  type ParentPayload = { title: string };
  type ChildPayload = { title: string };
  type ChildResponse = boolean;
  // `useLayerGroup` exposes a heterogeneous child stack — pin the concrete
  // child layer types at the outlet.
  type ChildState = LayerState<ChildPayload, ChildResponse>;
  type ChildCall = LayerCallContext<ChildPayload, ChildResponse>;

  let { call, payload }: LayerComponentProps<ParentPayload, void> = $props();

  // svelte-ignore state_referenced_locally
  const group = useLayerGroup(call);
  let childResult = $state<boolean | null>(null);

  const childConfirm = layerOptions<ChildPayload, ChildResponse>({
    key: ["example-nested", "child-confirm"],
  });

  async function deleteItem() {
    childResult = null;
    try {
      const ok = await group.open({
        ...childConfirm,
        payload: { title: "Really delete this item?" },
      });
      childResult = ok;
    } catch (error) {
      if (!isLayerCancelledError(error)) throw error;
    }
  }
</script>

<!--
App.svelte — host wiring:
  setLayerClient();
  const parentStack = useStack({ stack: "example-nested" });
  const parentDialog = layerOptions({ stack: "example-nested", key: ["example-nested", "parent"], component: ParentDialog });
  const c = createLayer(parentDialog);
  {#each parentStack.current as state (state.id)}
    {@const call = parentStack.callFor(state)}
    {#if call}<ParentDialog {call} payload={state.payload} ... />{/if}
  {/each}
  <button onclick={() => c.open({ title: "Edit item" })}>Open parent dialog</button>
-->

<div role="dialog" aria-modal="true" aria-label={payload.title}>
  <h2>{payload.title}</h2>
  <p>Remove this item from the list?</p>
  <button type="button" onclick={deleteItem}>Delete item</button>
  <button type="button" onclick={() => void call.dismiss()}>Close</button>
  {#if childResult !== null}
    <span>Child result: {String(childResult)}</span>
  {/if}
  {#each group.stack.current as raw (raw.id)}
    {@const s = raw as ChildState}
    {@const childCall = group.stack.callFor(raw) as ChildCall | null}
    {#if childCall}
      <div role="dialog" aria-modal="true">
        <h3>{s.payload.title}</h3>
        <button type="button" onclick={() => void childCall.end(false)}>Cancel</button>
        <button type="button" onclick={() => void childCall.end(true)}>Confirm</button>
      </div>
    {/if}
  {/each}
</div>
