import { ContextEvent } from "@lit/context";
import { LitElement, html } from "lit";
import { describe, expect, it } from "vitest";

import {
  defineStackElements,
  layerClientContext,
  layerOptions,
  LayerClient,
  StackProvider,
  useLayer,
} from "../src/index";
import type { LayerCallContext } from "../src/index";

defineStackElements();

class ConfirmDialog extends LitElement {
  static properties = {
    call: { attribute: false },
    payload: { attribute: false },
  };
  declare call: LayerCallContext<{ title: string }, boolean>;
  declare payload: { title: string };

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`<div role="dialog" aria-label=${this.payload.title}>
      <h2>${this.payload.title}</h2>
      <button type="button" @click=${() => void this.call.end(true)}>
        Yes
      </button>
    </div>`;
  }
}
customElements.define("test-layer-handle-dialog", ConfirmDialog);

const confirmOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 0,
});

class LayerHost extends LitElement {
  // No explicit client — must resolve from the <stack-provider> ancestor.
  #handle = useLayer(this, confirmOptions);

  createRenderRoot(): this {
    return this;
  }

  openLayer(): Promise<boolean> {
    return this.#handle.open({ title: "Remove?" });
  }

  render() {
    return html`<button type="button" @click=${() => void this.openLayer()}>
      Open
    </button>`;
  }
}
customElements.define("test-layer-host", LayerHost);

async function mountProviderHost(client: LayerClient) {
  const provider = document.createElement("stack-provider") as StackProvider &
    HTMLElement;
  provider.client = client;
  const outlet = document.createElement("stack-outlet") as HTMLElement & {
    stack: string;
    updateComplete: Promise<unknown>;
  };
  outlet.stack = "confirm";
  const host = document.createElement("test-layer-host") as HTMLElement & {
    updateComplete: Promise<unknown>;
    openLayer: () => Promise<boolean>;
  };
  provider.appendChild(host);
  provider.appendChild(outlet);
  document.body.appendChild(provider);
  await host.updateComplete;
  await outlet.updateComplete;
  return { provider, outlet, host };
}

describe("Lit adapter — useLayer lazy client", () => {
  it("dispatches one layer-client context-request on the useLayer host", async () => {
    const client = new LayerClient();
    const host = document.createElement("test-layer-host") as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    let layerClientRequests = 0;
    host.addEventListener("context-request", (e) => {
      const ev = e as InstanceType<typeof ContextEvent>;
      if (ev.context === layerClientContext) layerClientRequests += 1;
    });

    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    provider.appendChild(host);
    document.body.appendChild(provider);
    await host.updateComplete;

    expect(layerClientRequests).toBe(1);

    document.body.removeChild(provider);
  });

  it("resolves the client from context and opens/dismisses without an explicit client", async () => {
    const client = new LayerClient();
    const { outlet, host, provider } = await mountProviderHost(client);

    expect(outlet.querySelector('[role="dialog"]')).toBeNull();

    void host.openLayer();
    await outlet.updateComplete;
    await host.updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeTruthy();
    expect(outlet.textContent).toContain("Remove?");

    (outlet.querySelector("button") as HTMLButtonElement).click();
    await outlet.updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeNull();

    document.body.removeChild(provider);
  });

  it("throws on .open when no provider supplies a client", async () => {
    const host = document.createElement("test-layer-host") as HTMLElement & {
      updateComplete: Promise<unknown>;
      openLayer: () => Promise<boolean>;
    };
    document.body.appendChild(host);
    await host.updateComplete;

    expect(() => host.openLayer()).toThrow("[layers/lit]");
    document.body.removeChild(host);
  });
});
