<script lang="ts">
  import type { LayerComponentProps } from "../src/index";
  import { useMutationFlow } from "../src/index";

  let {
    call,
    payload,
    actionStatus,
  }: LayerComponentProps<{ title: string }, boolean> = $props();

  const flow = useMutationFlow(call);
</script>

<div role="dialog" aria-label={payload.title}>
  <span data-testid="status">{actionStatus}</span>
  <span data-testid="pending">{flow.pending ? "yes" : "no"}</span>
  <button
    type="button"
    onclick={() =>
      void flow
        .run(() => new Promise((resolve) => setTimeout(resolve, 30)))
        .orEnd(true)}
  >
    Save
  </button>
</div>
