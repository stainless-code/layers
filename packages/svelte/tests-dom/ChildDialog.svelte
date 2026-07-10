<script lang="ts">
  import type { LayerComponentProps } from "../src/index";

  let { call, payload }: LayerComponentProps<{ label: string }, string> =
    $props();
</script>

<div role="dialog" aria-label={payload.label}>
  <p>{payload.label}</p>
  <button type="button" onclick={() => call.end("done")}>Done</button>
</div>
