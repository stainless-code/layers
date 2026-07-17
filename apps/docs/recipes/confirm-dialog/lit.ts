import {
  createLayer,
  defineStackElements,
  layerOptions,
  LayerClient,
  provideLayerClient,
} from "@stainless-code/lit-layers";
import type { LayerCallContext } from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface ConfirmPayload {
  title: string;
}
type ConfirmResponse = boolean;

@customElement("example-confirm-dialog")
class ExampleConfirmDialog extends LitElement {
  // Light DOM so overlays stack inline where mounted.
  createRenderRoot(): this {
    return this;
  }

  @property({ attribute: false })
  declare call: LayerCallContext<ConfirmPayload, ConfirmResponse>;

  @property({ attribute: false })
  declare payload: ConfirmPayload;

  render() {
    return html`<div role="dialog" aria-modal="true">
      <h2>${this.payload.title}</h2>
      <div>
        <button type="button" @click=${() => void this.call.end(false)}>
          No
        </button>
        <button type="button" @click=${() => void this.call.end(true)}>
          Yes
        </button>
      </div>
    </div>`;
  }
}

const confirm = layerOptions<ConfirmPayload, ConfirmResponse>({
  stack: "example-confirm",
  key: ["example-confirm"],
  component: ExampleConfirmDialog,
  exitingDelay: 200,
});

const client = new LayerClient();
const confirmLayer = createLayer(confirm, client);

@customElement("example-trigger")
export class ExampleTrigger extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  @state()
  private _result: boolean | null = null;

  render() {
    return html`<div>
      <button
        type="button"
        @click=${async () => {
          this._result = null;
          const ok = await confirmLayer.open({ title: "Delete this file?" });
          this._result = ok;
        }}
      >
        Delete file
      </button>
      ${this._result !== null
        ? html`<span>Result: ${String(this._result)}</span>`
        : null}
    </div>`;
  }
}

@customElement("example-app")
class ExampleApp extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    provideLayerClient(this, client);
    defineStackElements();
  }

  render() {
    return html`<example-trigger></example-trigger>
      <stack-outlet stack="example-confirm"></stack-outlet>`;
  }
}

export default ExampleApp;
