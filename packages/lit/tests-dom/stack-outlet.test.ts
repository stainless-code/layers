import { ContextEvent } from "@lit/context";
import { LitElement, html } from "lit";
import { describe, expect, it, vi } from "vitest";

import {
  AppHostElement,
  defineStackElements,
  layerClientContext,
  layerOptions,
  LayerClient,
  StackOutlet,
  StackProvider,
  StackSubscribe,
  useLayerGroup,
  useMutationFlow,
} from "../src/index";
import type { LayerCallContext, LayerComponentProps } from "../src/index";

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
    expect(outlet.shadowRoot).toBeNull();
    const dialog = outlet.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(outlet.contains(dialog)).toBe(true);

    (outlet.querySelector("button") as HTMLButtonElement).click();
    await expect(pending).resolves.toBe(true);
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeNull();
  });

  it("does not remount the layer component when state changes", async () => {
    let mountCount = 0;
    class StatusDialog extends LitElement {
      static properties = {
        call: { attribute: false },
        payload: { attribute: false },
        actionStatus: { type: String },
      };
      declare call: LayerCallContext<{ title: string }, boolean>;
      declare payload: { title: string };
      declare actionStatus: string;

      createRenderRoot(): this {
        return this;
      }

      connectedCallback(): void {
        super.connectedCallback();
        mountCount += 1;
      }

      render() {
        return html`<div role="dialog" aria-label=${this.payload.title}>
          <span data-testid="status">${this.actionStatus}</span>
          <button type="button" @click=${() => this.call.setRunning(true)}>
            Run
          </button>
        </div>`;
      }
    }
    customElements.define("test-status-dialog", StatusDialog);

    const statusOptions = layerOptions<{ title: string }, boolean>({
      stack: "confirm",
      key: ["confirm", "status"],
      component: StatusDialog,
      exitingDelay: 0,
    });

    const client = new LayerClient();
    const { outlet } = await mountProvider(client);

    void client.open({
      ...statusOptions,
      payload: { title: "Status modal" },
    });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[role="dialog"]')).toBeTruthy();
    expect(mountCount).toBe(1);
    expect(outlet.querySelector('[data-testid="status"]')?.textContent).toBe(
      "idle",
    );

    (outlet.querySelector("button") as HTMLButtonElement).click();
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(mountCount).toBe(1);
    expect(outlet.querySelector('[data-testid="status"]')?.textContent).toBe(
      "running",
    );
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

  it("renders a TemplateResult function component", async () => {
    const fnOptions = layerOptions<{ title: string }, boolean>({
      stack: "fn",
      key: ["fn", "template"],
      component: (props: LayerComponentProps<{ title: string }, boolean>) =>
        html`<div role="dialog" data-fn>${props.payload.title}</div>`,
      exitingDelay: 0,
    });
    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "fn");

    void client.open({ ...fnOptions, payload: { title: "Fn layer" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector("[data-fn]")?.textContent).toBe("Fn layer");
  });

  it("stops updating after disconnect", async () => {
    const client = new LayerClient();
    const { provider, outlet } = await mountProvider(client);

    void client.open({
      ...confirmOptions,
      payload: { title: "Mounted" },
    });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    provider.remove();
    await Promise.resolve();

    expect(() => {
      void client.open({
        ...confirmOptions,
        payload: { title: "After disconnect" },
      });
    }).not.toThrow();
  });

  it("switches stacks when the stack property changes", async () => {
    const stackAOpts = layerOptions<{ title: string }, boolean>({
      stack: "a",
      key: ["a", "dialog"],
      component: (props: LayerComponentProps<{ title: string }, boolean>) =>
        html`<div data-stack="a">${props.payload.title}</div>`,
      exitingDelay: 0,
    });
    const stackBOpts = layerOptions<{ title: string }, boolean>({
      stack: "b",
      key: ["b", "dialog"],
      component: (props: LayerComponentProps<{ title: string }, boolean>) =>
        html`<div data-stack="b">${props.payload.title}</div>`,
      exitingDelay: 0,
    });

    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "a");

    void client.open({ ...stackAOpts, payload: { title: "On A" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();
    expect(outlet.querySelector('[data-stack="a"]')?.textContent).toBe("On A");

    outlet.stack = "b";
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;

    void client.open({ ...stackBOpts, payload: { title: "On B" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.querySelector('[data-stack="b"]')?.textContent).toBe("On B");
    expect(outlet.querySelector('[data-stack="a"]')).toBeNull();
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

  it("dispatches one layer-client context-request on the useLayerGroup host", async () => {
    const client = new LayerClient();
    const { outlet } = await mountProvider(client, "drawer");

    // Count requests on the parent host: capture bubbling context-request
    // before/during connect by listening on the outlet (composed events).
    let layerClientRequests = 0;
    outlet.addEventListener("context-request", (e) => {
      const ev = e as InstanceType<typeof ContextEvent>;
      if (ev.context === layerClientContext) layerClientRequests += 1;
    });

    void client.open({ ...parentOptions, payload: { title: "Parent" } });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();
    await Promise.resolve();

    const parent = outlet.querySelector("test-parent-drawer");
    expect(parent).toBeTruthy();
    // ParentDrawer: one shared resolve for the group (not group + #states).
    expect(layerClientRequests).toBe(1);
  });
});

describe("Lit adapter — StackProvider", () => {
  it("uses shadow DOM + slot (context still reaches light children)", async () => {
    const client = new LayerClient();
    const { provider, outlet } = await mountProvider(client);

    expect(provider.shadowRoot).toBeTruthy();
    expect(provider.shadowRoot?.querySelector("slot")).toBeTruthy();
    // Light-DOM child remains a direct child; composed context still resolves.
    expect(outlet.parentElement).toBe(provider);
    expect(outlet.shadowRoot).toBeNull();

    void client.open({
      ...confirmOptions,
      payload: { title: "Via shadow provider" },
    });
    await (outlet as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    await Promise.resolve();

    expect(outlet.textContent).toContain("Via shadow provider");
  });
});

describe("Lit adapter — defineStackElements", () => {
  it("is idempotent (no double-register)", () => {
    expect(() => defineStackElements()).not.toThrow();
    expect(customElements.get("stack-provider")).toBe(StackProvider);
    expect(customElements.get("stack-outlet")).toBe(StackOutlet);
    expect(customElements.get("stack-subscribe")).toBe(StackSubscribe);
    expect(customElements.get("app-host")).toBe(AppHostElement);
  });
});
