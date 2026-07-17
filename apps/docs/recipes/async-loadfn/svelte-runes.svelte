<script lang="ts">
  import {
    type LayerCallContext,
    type LayerState,
    createLayer,
    LayerClient,
    layerOptions,
    setLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  interface Profile {
    name: string;
    role: string;
    initials: string;
  }

  type ProfilePayload = { userId: string };
  type ProfileResponse = void;
  // `useStack` is heterogeneous — pin the concrete layer types at the outlet.
  type ProfileState = LayerState<ProfilePayload, ProfileResponse, never, Profile>;
  type ProfileCall = LayerCallContext<ProfilePayload, ProfileResponse>;

  const layerClient = new LayerClient();

  setLayerClient(layerClient);
  const profileStack = useStack({ stack: "example-async-loadfn" });

  const profile = layerOptions<ProfilePayload, ProfileResponse, never, Profile>({
    stack: "example-async-loadfn",
    key: ["example-async-loadfn"],
    loadFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return {
        name: "Ada Lovelace",
        role: "Founding Engineer",
        initials: "AL",
      };
    },
  });

  const c = createLayer(profile);

  let phase = $state<"idle" | "loading" | "done">("idle");

  async function openProfile() {
    phase = "loading";
    await c.open({ userId: "ada" });
    phase = "done";
  }
</script>

{#each profileStack.current as raw (raw.id)}
  {@const state = raw as ProfileState}
  {@const call = profileStack.callFor(raw) as ProfileCall | null}
  {#if call}
    <div role="dialog" aria-modal="true" aria-label={`Profile ${state.payload.userId}`}>
      {#if state.phase === "pending"}
        <p>Loading profile…</p>
      {:else}
        <div>
          <h2>{state.data?.name}</h2>
          <p>{state.data?.role}</p>
          <span>{state.data?.initials}</span>
        </div>
      {/if}
      <button type="button" onclick={() => void call.dismiss()}>Close</button>
    </div>
  {/if}
{/each}

<div>
  <button type="button" onclick={openProfile}>Open async dialog</button>
  {#if phase !== "idle"}
    <span>{phase === "loading" ? "Loading…" : "Closed"}</span>
  {/if}
</div>
