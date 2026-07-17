import {
  defineStackElements,
  layerOptions,
  provideLayerClient,
  useLayer,
} from "@stainless-code/lit-layers";
import type { LayerCallContext } from "@stainless-code/lit-layers";
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// Register CE tags once (idempotent). Official Lit: define before first use.
defineStackElements();

interface ConfirmPayload {
  title: string;
}
type ConfirmResponse = boolean;

@customElement("example-confirm-dialog")
class ExampleConfirmDialog extends LitElement {
  // Light DOM — Lit docs: return `this` from createRenderRoot.
  // Overlay hosts avoid shadow so stacking stays where the outlet is mounted.
  createRenderRoot(): this {
    return this;
  }

  // LayerElementDirective assigns these; @property makes them reactive (Lit).
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
});

@customElement("example-trigger")
export class ExampleTrigger extends LitElement {
  createRenderRoot(): this {
    return this;
  }

  // Resolves LayerClient from an ancestor provideLayerClient / <stack-provider>.
  #confirm = useLayer(this, confirm);

  @state()
  private _result: boolean | null = null;

  render() {
    return html`<div>
      <button
        type="button"
        @click=${async () => {
          this._result = null;
          const ok = await this.#confirm.open({ title: "Delete this file?" });
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
  constructor() {
    super();
    // Attach ContextProvider before the first update (children resolve in render).
    provideLayerClient(this);
  }

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`<example-trigger></example-trigger>
      <stack-outlet stack="example-confirm"></stack-outlet>`;
  }
}

export default ExampleApp;
