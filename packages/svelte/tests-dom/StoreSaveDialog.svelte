<script lang="ts">
  import type { LayerComponentProps } from "../src/store";
  import { useMutationFlow } from "../src/store";

  let {
    call,
    payload,
    actionStatus,
  }: LayerComponentProps<{ title: string }, boolean> = $props();

  const flow = useMutationFlow(call);
  const pending = flow.pending;
</script>

<div role="dialog" aria-label={payload.title}>
  <span data-testid="status">{actionStatus}</span>
  <span data-testid="pending">{$pending ? "yes" : "no"}</span>
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
