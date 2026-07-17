import { createCallContext } from "@stainless-code/layers";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import layers, {
  layerOptions,
  LayerClient,
  setLayerClient,
} from "../src/index";
import { __resetLayerClientForTests } from "../src/layer-client";

const modalOptions = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "outlet"],
  exitingDelay: 0,
});

beforeAll(() => {
  Alpine.plugin(layers);
});

let alpineStarted = false;

function mount(html: string, client: LayerClient) {
  __resetLayerClientForTests();
  setLayerClient(client);
  document.body.innerHTML = html;
  if (!alpineStarted) {
    Alpine.start();
    alpineStarted = true;
  } else {
    Alpine.initTree(document.body);
  }
  return Alpine.nextTick();
}

describe("Alpine adapter — plugin + outlet", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    __resetLayerClientForTests();
  });

  it("x-layer-outlet renders cloned markup and $layer.call.end resolves open", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div id="app" x-data>
        <template x-layer-outlet="'modal'">
          <div>
            <button type="button" @click="$layer.call.end(true)">
              Close <span x-text="JSON.stringify($layer.payload)"></span>
            </button>
          </div>
        </template>
      </div>
    `,
      client,
    );

    const pending = client.open({
      ...modalOptions,
      payload: { title: "Outlet modal" },
    });

    await viWaitFor(() =>
      expect(document.body.textContent).toContain("Outlet modal"),
    );

    const button = document.querySelector("button");
    expect(button).toBeTruthy();
    button!.click();

    await expect(pending).resolves.toBe(true);
    await viWaitFor(() => expect(document.querySelector("button")).toBeNull());
  });

  it("keeps the outlet row mounted and refreshes $layer.transition on settle", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div id="app" x-data>
        <template x-layer-outlet="'modal'">
          <div x-data>
            <span id="tr" x-text="$layer.transition"></span>
            <span id="title" x-text="$layer.payload.title"></span>
          </div>
        </template>
      </div>
    `,
      client,
    );

    const pending = client.open({
      ...modalOptions,
      enteringDelay: 80,
      payload: { title: "Phase" },
    });

    await viWaitFor(() =>
      expect(document.getElementById("tr")?.textContent).toBe("entering"),
    );
    const row = document.getElementById("tr");
    await viWaitFor(() =>
      expect(document.getElementById("tr")?.textContent).toBe("settled"),
    );
    expect(document.getElementById("tr")).toBe(row);

    const stack = client.getStack("modal");
    const state = stack.getSnapshot()[0]!;
    createCallContext(
      stack as never,
      stack.getLayer(state.id)! as never,
      state as never,
    ).end(true);
    await pending;
  });

  it("resolves $layer through x-teleport via _x_teleportBack", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div id="app" x-data>
        <template x-layer-outlet="'modal'">
          <template x-teleport="body">
            <div>
              <button type="button" id="tel" @click="$layer.call.end(true)">
                Close <span x-text="$layer.payload.title"></span>
              </button>
            </div>
          </template>
        </template>
      </div>
    `,
      client,
    );

    const pending = client.open({
      ...modalOptions,
      payload: { title: "Teleported" },
    });

    await viWaitFor(() =>
      expect(document.getElementById("tel")?.textContent).toContain(
        "Teleported",
      ),
    );
    expect(document.getElementById("tel")?.closest("#app")).toBeNull();

    document.getElementById("tel")!.click();
    await expect(pending).resolves.toBe(true);
    await viWaitFor(() => expect(document.getElementById("tel")).toBeNull());
  });

  it("outlet cleanup unsubscribes the stack", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div id="app" x-data>
        <template x-layer-outlet="'modal'">
          <div><span x-text="$layer.payload.title"></span></div>
        </template>
      </div>
    `,
      client,
    );

    const stack = client.getStack("modal");
    expect(stack.size).toBeGreaterThan(0);

    const app = document.getElementById("app")!;
    Alpine.destroyTree(app);
    app.remove();
    expect(stack.size).toBe(0);
  });

  it("x-layer-outlet rebinds when the stack id expression changes", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div id="app" x-data="{ sid: 'modal' }">
        <template x-layer-outlet="sid">
          <div>
            <span id="row" x-text="$layer.payload.title"></span>
          </div>
        </template>
      </div>
    `,
      client,
    );

    const other = layerOptions<{ title: string }, boolean>({
      stack: "other",
      key: ["modal", "other"],
      exitingDelay: 0,
    });

    void client.open({
      ...modalOptions,
      payload: { title: "On modal" },
    });
    await viWaitFor(() =>
      expect(document.getElementById("row")?.textContent).toBe("On modal"),
    );

    const app = document.getElementById("app")!;
    (Alpine.$data(app) as { sid: string }).sid = "other";
    await Alpine.nextTick();

    void client.open({
      ...other,
      payload: { title: "On other" },
    });
    await viWaitFor(() =>
      expect(document.getElementById("row")?.textContent).toBe("On other"),
    );
  });
});

function viWaitFor(assertion: () => void, timeout = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      try {
        assertion();
        resolve();
      } catch (err) {
        // Macrotask: enter/exit delays use setTimeout and must not be starved.
        if (Date.now() - start > timeout) reject(err);
        else setTimeout(tick, 0);
      }
    };
    tick();
  });
}
