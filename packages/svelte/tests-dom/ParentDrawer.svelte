<script lang="ts">
  import type { LayerComponentProps } from "../src/index";
  import { useLayerGroup } from "../src/index";

  import { childOptions, childPending } from "./layers";

  let { call, payload }: LayerComponentProps<{ title: string }, boolean> =
    $props();

  const group = useLayerGroup(call);
</script>

<div role="dialog" aria-label={payload.title}>
  <h2>{payload.title}</h2>
  <button
    type="button"
    data-testid="open-child"
    onclick={() => {
      childPending.current = group.open({
        ...childOptions,
        payload: { label: "Child" },
      });
    }}
  >
    Open child
  </button>
  {#each group.stack.current as s (s.id)}
    {@const childCall = group.stack.callFor(s)}
    {#if childCall}
      {@const Comp = childOptions.component}
      <Comp
        call={childCall}
        payload={s.payload}
        data={s.data}
        error={s.error}
        phase={s.phase}
        transition={s.transition}
        actionStatus={s.actionStatus}
        dismissing={s.dismissing}
      />
    {/if}
  {/each}
  <button type="button" onclick={() => call.end(false)}>Close</button>
</div>
