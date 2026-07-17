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
    code: `import { LayerClient, createLayer, layerOptions } from "@stainless-code/layers";

const client = new LayerClient();

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: renderConfirm, // your render fn
});

const c = createLayer(confirm, client);

async function remove() {
  const ok = await c.open({ title: "Remove?" });
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
  useLayer,
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
      <RemoveButton />
    </StackProvider>
  );
}

function RemoveButton() {
  const c = useLayer(confirm);
  async function remove() {
    const ok = await c.open({ title: "Remove?" });
    //    ^? boolean
  }
  return <button onClick={() => void remove()}>Remove</button>;
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
  useLayer,
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
      <RemoveButton />
    </StackProvider>
  );
}

function RemoveButton() {
  const c = useLayer(confirm);
  async function remove() {
    const ok = await c.open({ title: "Remove?" });
    //    ^? boolean
  }
  return <button onClick={() => void remove()}>Remove</button>;
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
  useLayer,
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
  const c = useLayer(confirm);
  async function remove() {
    const ok = await c.open({ title: "Remove?" });
    //    ^? boolean
  }
  return <button onClick={() => void remove()}>Remove</button>;
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
  injectLayer,
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
  private c = injectLayer(confirm);
  private vcr = inject(ViewContainerRef);

  constructor() {
    renderStack(this.vcr, "confirm");
  }

  async remove() {
    const ok = await this.c.open({ title: "Remove?" });
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
  useLayer,
} from "@stainless-code/vue-layers";

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

provideLayerClient();
const c = useLayer(confirm);

async function remove() {
  const ok = await c.open({ title: "Remove?" });
  //    ^? boolean
}
</script>

<template>
  <StackOutlet stack="confirm" />
  <button @click="remove">Remove</button>
</template>`,
  },
  {
    framework: "lit",
    icon: "/icons/lit.svg",
    label: "Lit",
    installCommand: "bun add @stainless-code/lit-layers",
    lang: "ts",
    code: `import {
  LayerClient,
  createLayer,
  defineStackElements,
  layerOptions,
} from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";

defineStackElements();

const confirm = layerOptions({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
});

const client = new LayerClient();
const c = createLayer(confirm, client);

async function remove() {
  const ok = await c.open({ title: "Remove?" });
  //    ^? boolean
}

// Shell:
// <stack-provider .client=\${client}>
//   <stack-outlet stack="confirm"></stack-outlet>
// </stack-provider>`,
  },
  {
    framework: "svelte",
    icon: "/icons/svelte.svg",
    label: "Svelte",
    installCommand: "bun add @stainless-code/svelte-layers",
    lang: "svelte",
    code: `<script lang="ts">
  import {
    createLayer,
    layerOptions,
    setLayerClient,
    useStack,
  } from "@stainless-code/svelte-layers";

  const confirm = layerOptions({
    stack: "confirm",
    key: ["confirm", "remove"],
  });

  setLayerClient();
  const stack = useStack({ stack: "confirm" });
  const c = createLayer(confirm);

  async function remove() {
    const ok = await c.open({ title: "Remove?" });
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
    createLayer,
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
  const c = createLayer(confirm);

  async function remove() {
    const ok = await c.open({ title: "Remove?" });
    //    ^? boolean
  }
</script>

{#each $stack as state (state.id)}
  {@const call = callFor(client, "confirm", state)}
  <!-- render your dialog with call + state.payload -->
{/each}

<button onclick={remove}>Remove</button>`;
