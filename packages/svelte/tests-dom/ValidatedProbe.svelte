<script lang="ts">
  import type { LayerClient, StandardSchemaV1 } from "@stainless-code/layers";

  import {
    createLayer,
    setLayerClient,
    type WiredValidatedLayerHandle,
  } from "../src/index";

  let {
    client,
    onReady,
  }: {
    client: LayerClient;
    onReady: (
      handle: WiredValidatedLayerHandle<
        StandardSchemaV1<{ id: string }, { id: number }>,
        unknown
      >,
    ) => void;
  } = $props();

  setLayerClient(client);

  const idSchema = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (v: unknown) => ({
        value: { id: Number((v as { id: string }).id) },
      }),
      types: undefined as unknown as {
        input: { id: string };
        output: { id: number };
      },
    },
  } as StandardSchemaV1<{ id: string }, { id: number }>;

  const validatedOptions = {
    stack: "default",
    key: ["v"],
    validate: idSchema,
    exitingDelay: 0,
  };

  const handle = createLayer(validatedOptions, client);
  onReady(handle);
</script>

<span data-testid="payload-id">{handle.state[0]?.payload.id ?? "none"}</span>
