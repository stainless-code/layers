export interface AdapterSnippet {
  framework: string;
  icon: string;
  label: string;
  code: string;
  lang: string;
  installCommand: string;
}

export const adapterSnippets: AdapterSnippet[] = [
  {
    framework: "vanilla",
    icon: "/icons/vanilla.svg",
    label: "Vanilla",
    installCommand: "bun add @stainless-code/layers",
    lang: "ts",
    code: `import { LayerClient, layerOptions } from "@stainless-code/layers";

const client = new LayerClient();

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: renderConfirm, // your render fn
});

async function remove() {
  const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
  //    ^? boolean
}`,
  },
  {
    framework: "react",
    icon: "/icons/react.svg",
    label: "React",
    installCommand: "bun add @stainless-code/react-layers",
    lang: "tsx",
    code: `import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/react-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

function RemoveButton() {
  const client = useLayerClient();
  async function remove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
}`,
  },
  {
    framework: "preact",
    icon: "/icons/preact.svg",
    label: "Preact",
    installCommand: "bun add @stainless-code/preact-layers",
    lang: "tsx",
    code: `import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/preact-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

function App() {
  return (
    <StackProvider>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

function RemoveButton() {
  const client = useLayerClient();
  async function remove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
}`,
  },
  {
    framework: "solid",
    icon: "/icons/solid.svg",
    label: "Solid",
    installCommand: "bun add @stainless-code/solid-layers",
    lang: "tsx",
    code: `import {
  LayerClient,
  LayerClientContext,
  StackOutlet,
  layerOptions,
  useLayerClient,
} from "@stainless-code/solid-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

const client = new LayerClient();

function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="confirm" />
      <RemoveButton />
    </LayerClientContext.Provider>
  );
}

function RemoveButton() {
  const client = useLayerClient();
  async function remove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
}`,
  },
  {
    framework: "angular",
    icon: "/icons/angular.svg",
    label: "Angular",
    installCommand: "bun add @stainless-code/angular-layers",
    lang: "ts",
    code: `import { Component, ViewContainerRef, inject } from "@angular/core";
import {
  layerOptions,
  provideLayerClient,
  renderStack,
  useLayerClient,
} from "@stainless-code/angular-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialogComponent,
});

@Component({
  selector: "app-root",
  providers: [provideLayerClient()],
  template: \`<button (click)="remove()">Remove</button><ng-container #outlet />\`,
})
export class AppComponent {
  private client = useLayerClient();
  private vcr = inject(ViewContainerRef);

  constructor() {
    renderStack(this.vcr, "confirm");
  }

  async remove() {
    const ok = await this.client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
}`,
  },
  {
    framework: "vue",
    icon: "/icons/vue.svg",
    label: "Vue",
    installCommand: "bun add @stainless-code/vue-layers",
    lang: "vue",
    code: `<script setup lang="ts">
import {
  layerOptions,
  provideLayerClient,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/vue-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

provideLayerClient();

async function remove() {
  const client = useLayerClient();
  const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
  //    ^? boolean
}
</script>

<template>
  <StackOutlet stack="confirm" />
  <button @click="remove">Remove</button>
</template>`,
  },
  {
    framework: "svelte",
    icon: "/icons/svelte.svg",
    label: "Svelte",
    installCommand: "bun add @stainless-code/svelte-layers",
    lang: "svelte",
    code: `<script lang="ts">
  import {
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  const confirm = layerOptions({
    stack: "confirm",
    key: ["confirm", "remove"],
  });

  setLayerClient();
  const client = useLayerClient();
  const stack = useStack({ stack: "confirm" });

  async function remove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
</script>

{#each stack.current as state (state.id)}
  {@const call = stack.callFor(state)}
  <!-- render your dialog with call + state.payload -->
{/each}

<button onclick={remove}>Remove</button>`,
  },
];

export const svelteStoreCode = `<script lang="ts">
  import {
    callFor,
    layerOptions,
    setLayerClient,
    useLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers/store";

  const confirm = layerOptions({
    stack: "confirm",
    key: ["confirm", "remove"],
  });

  setLayerClient();
  const client = useLayerClient();
  const stack = useStack({ stack: "confirm" });

  async function remove() {
    const ok = await client.open({ ...confirm, payload: { title: "Remove?" } });
    //    ^? boolean
  }
</script>

{#each $stack as state (state.id)}
  {@const call = callFor(client, "confirm", state)}
  <!-- render your dialog with call + state.payload -->
{/each}

<button onclick={remove}>Remove</button>`;
