import { LitElement, html } from "lit";
import { describe, expect, it } from "vitest";

import {
  defineStackElements,
  layerOptions,
  LayerClient,
  StackProvider,
  useStackHandles,
} from "../src/index";

defineStackElements();

const modalOptions = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "headless"],
  exitingDelay: 0,
});

class HeadlessHost extends LitElement {
  #handles = useStackHandles(this, "modal");

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`${this.#handles.states.current.map(
      (s) => html`<button
        type="button"
        @click=${() => this.#handles.getCall(s).end(true)}
      >
        Close ${JSON.stringify(s.payload)}
      </button>`,
    )}`;
  }
}
customElements.define("test-headless-host", HeadlessHost);

describe("Lit adapter — headless render", () => {
  it("useStackHandles renders custom close controls and ends the layer", async () => {
    const client = new LayerClient();
    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    const host = document.createElement(
      "test-headless-host",
    ) as HeadlessHost & {
      updateComplete: Promise<unknown>;
    };
    provider.appendChild(host);
    document.body.appendChild(provider);
    await host.updateComplete;

    const pending = client.open({
      ...modalOptions,
      payload: { title: "Headless modal" },
    });
    await host.updateComplete;

    const button = host.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain("Headless modal");

    button!.click();
    await expect(pending).resolves.toBe(true);
    await host.updateComplete;
    expect(host.querySelector("button")).toBeNull();

    document.body.removeChild(provider);
  });
});
