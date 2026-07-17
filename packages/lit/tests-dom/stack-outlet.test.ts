import { LitElement, html } from "lit";
import { describe, expect, it, vi } from "vitest";

import {
  defineStackElements,
  layerOptions,
  LayerClient,
  StackOutlet,
  StackProvider,
  StackSubscribe,
  useLayerGroup,
  useMutationFlow,
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
customElements.define("test-confirm-dialog", ConfirmDialog);

const confirmOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["confirm", "remove"],
  component: ConfirmDialog,
  exitingDelay: 0,
});

const noComponentOptions = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "no-component"],
  exitingDelay: 0,
});

async function mountProvider(client: LayerClient, stack = "confirm") {
  const provider = document.createElement("stack-provider") as StackProvider &
    HTMLElement;
  provider.client = client;
  const outlet = document.createElement("stack-outlet") as StackOutlet &
    HTMLElement;
  outlet.stack = stack;
  provider.appendChild(outlet);
  document.body.appendChild(provider);
  await (outlet as unknown as { updateComplete: Promise<unknown> })
    .updateComplete;
  return { provider, outlet };
}

describe("Lit adapter — StackOutlet", () => {
  it("renders on open and removes on close (light DOM)", async () => {
    const client = new LayerClient();
    const { outlet } = await mountProvider(client);

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export" },
    });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeTruthy();
    expect(outlet.textContent).toContain("Remove export");

    (outlet.querySelector("button") as HTMLButtonElement).click();
    await expect(pending).resolves.toBe(true);
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeNull();
  });

  it("dev-warns on missing component and renders nothing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "modal");

    void client.open({
      ...noComponentOptions,
      payload: { title: "No component" },
    });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    const warnMessage = warnSpy.mock.calls.find(([msg]) =>
      String(msg).includes("[layers/lit]"),
    );
    expect(warnMessage).toBeTruthy();
    expect(String(warnMessage?.[0])).toContain("No component for layer");
    expect(outlet.querySelector('[role="dialog"]')).toBeNull();
    expect(outlet.querySelector("button")).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("Lit adapter — StackSubscribe", () => {
  it("renders the selected value through .renderer", async () => {
    const client = new LayerClient();
    const provider = document.createElement("stack-provider") as StackProvider &
      HTMLElement;
    provider.client = client;
    const sub = document.createElement("stack-subscribe") as StackSubscribe &
      HTMLElement;
    sub.stack = "s";
    sub.selector = (states) => states.length;
    sub.renderer = (value: unknown) =>
      html`<span data-testid="count">${String(value)}</span>`;
    provider.appendChild(sub);
    document.body.appendChild(provider);
    await (sub as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;

    expect(sub.querySelector('[data-testid="count"]')?.textContent).toBe("0");

    void client.open({ key: ["a"], payload: 1, stack: "s" });
    await (sub as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(sub.querySelector('[data-testid="count"]')?.textContent).toBe("1");
  });
});

class SaveDialog extends LitElement {
  static properties = {
    call: { attribute: false },
    actionStatus: { attribute: false },
  };
  declare call: LayerCallContext<{ title: string }, boolean>;
  declare actionStatus: string;

  createRenderRoot(): this {
    return this;
  }

  #flow?: ReturnType<typeof useMutationFlow<{ title: string }, boolean>>;
  render() {
    if (!this.#flow)
      this.#flow = useMutationFlow<{ title: string }, boolean>(this, this.call);
    return html`<div role="dialog">
      <span data-testid="status">${this.actionStatus}</span>
      <button
        type="button"
        @click=${() => void this.#flow!.run(async () => {}).orEnd(true)}
      >
        Save
      </button>
    </div>`;
  }
}
customElements.define("test-save-dialog", SaveDialog);

const saveOptions = layerOptions<{ title: string }, boolean>({
  stack: "save",
  key: ["save", "export"],
  component: SaveDialog,
  exitingDelay: 0,
});

describe("Lit adapter — useMutationFlow", () => {
  it("drives actionStatus to running then ends on success", async () => {
    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "save");

    void client.open({ ...saveOptions, payload: { title: "Save" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[data-testid="status"]')?.textContent).toBe(
      "idle",
    );

    (outlet.querySelector("button") as HTMLButtonElement).click();
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[data-testid="status"]')?.textContent).toBe(
      "running",
    );

    await Promise.resolve();
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeNull();
  });
});

class ParentDrawer extends LitElement {
  static properties = {
    call: { attribute: false },
    payload: { attribute: false },
  };
  declare call: LayerCallContext<{ title: string }, boolean>;
  declare payload: { title: string };
  #group?: ReturnType<typeof useLayerGroup<{ title: string }, boolean>>;

  createRenderRoot(): this {
    return this;
  }

  render() {
    if (!this.#group) {
      this.#group = useLayerGroup<{ title: string }, boolean>(this, this.call);
    }
    return html`<div role="dialog" aria-label=${this.payload.title}>
      <h2>${this.payload.title}</h2>
      <button
        type="button"
        @click=${() =>
          void this.#group!.open({
            ...childOptions,
            payload: { label: "Child" },
          })}
      >
        Open child
      </button>
      ${this.#group.outlet()}
    </div>`;
  }
}
customElements.define("test-parent-drawer", ParentDrawer);

class ChildDialog extends LitElement {
  static properties = {
    call: { attribute: false },
    payload: { attribute: false },
  };
  declare call: LayerCallContext<{ label: string }, string>;
  declare payload: { label: string };

  createRenderRoot(): this {
    return this;
  }

  render() {
    return html`<div role="dialog" aria-label=${this.payload.label}>
      <p>${this.payload.label}</p>
    </div>`;
  }
}
customElements.define("test-child-dialog", ChildDialog);

const childOptions = layerOptions<{ label: string }, string>({
  key: ["drawer", "child"],
  component: ChildDialog,
  exitingDelay: 0,
});

const parentOptions = layerOptions<{ title: string }, boolean>({
  stack: "drawer",
  key: ["drawer", "parent"],
  component: ParentDrawer,
  exitingDelay: 0,
});

describe("Lit adapter — useLayerGroup", () => {
  it("renders a nested layer through group.outlet()", async () => {
    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "drawer");

    void client.open({ ...parentOptions, payload: { title: "Parent" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();
    await Promise.resolve();

    expect(outlet.querySelector('[aria-label="Parent"]')).toBeTruthy();

    (
      Array.from(outlet.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Open child"),
      ) as HTMLButtonElement
    ).click();
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[aria-label="Child"]')).toBeTruthy();
    expect(outlet.textContent).toContain("Child");
  });
});

describe("Lit adapter — defineStackElements", () => {
  it("is idempotent (no double-register)", () => {
    expect(() => defineStackElements()).not.toThrow();
    expect(customElements.get("stack-provider")).toBe(StackProvider);
    expect(customElements.get("stack-outlet")).toBe(StackOutlet);
    expect(customElements.get("stack-subscribe")).toBe(StackSubscribe);
  });
});
