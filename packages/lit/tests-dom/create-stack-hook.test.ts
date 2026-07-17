import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient } from "@stainless-code/layers";
import { LitElement, html } from "lit";
import { describe, expect, it, vi } from "vitest";

import {
  AppHostElement,
  createStackHook,
  defineStackElements,
} from "../src/index";
import type { AppLayerProps, StackProvider } from "../src/index";

defineStackElements();

class ModalDialogEl extends LitElement {
  static properties = {
    call: { attribute: false },
    payload: { attribute: false },
  };
  declare call: LayerComponentProps<{ title: string }, boolean>["call"];
  declare payload: { title: string };

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`<div role="dialog" aria-label=${this.payload.title}>
      <h2>${this.payload.title}</h2>
      <button type="button" @click=${() => void this.call.end(true)}>
        Confirm
      </button>
    </div>`;
  }
}
customElements.define("test-modal-dialog", ModalDialogEl);

const modalLayerOpts = {
  key: ["modal", "settings"],
  component: ModalDialogEl,
  exitingDelay: 0,
};

async function updateComplete(el: HTMLElement): Promise<void> {
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await Promise.resolve();
}

describe("Lit adapter — createStackHook", () => {
  it("useAppStack.open binds the stack", async () => {
    const client = new LayerClient();
    const { useAppStack } = createStackHook({
      stack: "modal",
    });
    let pending: Promise<boolean> | undefined;

    class Trigger extends LitElement {
      #app = useAppStack(this);

      createRenderRoot(): this {
        return this;
      }

      render() {
        return html`<button
          type="button"
          @click=${() => {
            pending = this.#app.open({
              ...modalLayerOpts,
              payload: { title: "Settings" },
            });
          }}
        >
          Open
        </button>`;
      }
    }
    customElements.define("test-lit-trigger", Trigger);

    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    const host = document.createElement("app-host") as AppHostElement &
      HTMLElement;
    host.stack = "modal";
    const trigger = document.createElement("test-lit-trigger");
    provider.append(host, trigger);
    document.body.appendChild(provider);
    await updateComplete(provider);
    await updateComplete(host);

    trigger.querySelector("button")!.click();
    await updateComplete(host);
    await Promise.resolve();

    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    expect(host.textContent).toContain("Settings");
    expect(client.getStack("modal").getSnapshot()).toHaveLength(1);
    expect(pending).toBeDefined();

    (host.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await Promise.resolve();
    await updateComplete(host);

    await expect(pending!).resolves.toBe(true);
    await updateComplete(host);

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);

    provider.remove();
  });

  it("AppLayer controlled open/close", async () => {
    const client = new LayerClient();
    const onResolved = vi.fn();
    const { AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "settings"],
      component: ModalDialogEl,
      exitingDelay: 0,
    } satisfies Omit<
      AppLayerProps<{ title: string }, boolean>["options"],
      never
    >;

    class ControlledLayer extends LitElement {
      static properties = {
        open: { type: Boolean },
      };
      declare open: boolean;
      #layer?: InstanceType<typeof AppLayer>;

      constructor() {
        super();
        this.open = false;
      }

      createRenderRoot(): this {
        return this;
      }

      connectedCallback(): void {
        super.connectedCallback();
        this.#layer = new AppLayer(this, {
          options: layerOpts,
          open: this.open,
          payload: { title: "Controlled" },
          onResolved,
        });
      }

      updated(): void {
        if (this.#layer) {
          this.#layer.open = this.open;
        }
      }

      render() {
        return html`<button type="button" @click=${() => (this.open = true)}>
            Show
          </button>
          <button type="button" @click=${() => (this.open = false)}>
            Hide
          </button>`;
      }
    }
    customElements.define("test-lit-controlled", ControlledLayer);

    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    const host = document.createElement("app-host") as AppHostElement &
      HTMLElement;
    host.stack = "modal";
    const controlled = document.createElement(
      "test-lit-controlled",
    ) as ControlledLayer & HTMLElement;
    provider.append(host, controlled);
    document.body.appendChild(provider);
    await updateComplete(provider);
    await updateComplete(host);

    (controlled.querySelectorAll("button")[0] as HTMLButtonElement).click();
    await updateComplete(host);
    await Promise.resolve();

    expect(host.querySelector('[role="dialog"]')).toBeTruthy();
    expect(host.textContent).toContain("Controlled");

    const confirmBtn = host.querySelector(
      "test-modal-dialog button",
    ) as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    await updateComplete(host);

    expect(onResolved).toHaveBeenCalledWith(true);
    await updateComplete(host);

    expect(host.querySelector('[role="dialog"]')).toBeNull();

    provider.remove();
  });

  it("AppLayer dismisses when open flips true to false", async () => {
    const client = new LayerClient();
    const { AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "dismiss-test"],
      component: ModalDialogEl,
      exitingDelay: 0,
    };

    class ControlledLayer extends LitElement {
      static properties = {
        open: { type: Boolean },
      };
      declare open: boolean;
      #layer?: InstanceType<typeof AppLayer>;

      constructor() {
        super();
        this.open = false;
      }

      createRenderRoot(): this {
        return this;
      }

      connectedCallback(): void {
        super.connectedCallback();
        this.#layer = new AppLayer(this, {
          options: layerOpts,
          open: this.open,
          payload: { title: "Dismiss me" },
        });
      }

      updated(): void {
        if (this.#layer) {
          this.#layer.open = this.open;
        }
      }

      render() {
        return html`<button type="button" @click=${() => (this.open = true)}>
            Show
          </button>
          <button type="button" @click=${() => (this.open = false)}>
            Hide
          </button>`;
      }
    }
    customElements.define("test-lit-dismiss", ControlledLayer);

    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    const host = document.createElement("app-host") as AppHostElement &
      HTMLElement;
    host.stack = "modal";
    const controlled = document.createElement(
      "test-lit-dismiss",
    ) as ControlledLayer & HTMLElement;
    provider.append(host, controlled);
    document.body.appendChild(provider);
    await updateComplete(provider);
    await updateComplete(host);

    (controlled.querySelectorAll("button")[0] as HTMLButtonElement).click();
    await updateComplete(host);
    await Promise.resolve();
    expect(host.querySelector('[role="dialog"]')).toBeTruthy();

    (controlled.querySelectorAll("button")[1] as HTMLButtonElement).click();
    await updateComplete(host);
    await Promise.resolve();

    expect(host.querySelector('[role="dialog"]')).toBeNull();

    provider.remove();
  });
});
