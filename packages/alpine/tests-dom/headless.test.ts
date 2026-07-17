import Alpine from "alpinejs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import layers, { LayerClient, setLayerClient } from "../src/index";
import { __resetLayerClientForTests } from "../src/layer-client";

beforeAll(() => {
  Alpine.plugin(layers);
});

let alpineStarted = false;

async function mount(html: string, client: LayerClient) {
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

describe("Alpine adapter — headless layerStack", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    __resetLayerClientForTests();
  });

  it("layerStack data renders states and callFor ends the layer", async () => {
    const client = new LayerClient();
    await mount(
      `
      <div x-data="layerStack('modal')">
        <template x-for="state in states" :key="state.id">
          <button type="button" @click="callFor(state)?.end(true)">
            Close
          </button>
        </template>
      </div>
    `,
      client,
    );

    const pending = client.open({
      key: ["headless"],
      payload: { n: 1 },
      stack: "modal",
    });

    await viWaitFor(() =>
      expect(document.querySelector("button")).toBeTruthy(),
    );
    document.querySelector("button")!.click();
    await expect(pending).resolves.toBe(true);
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
        if (Date.now() - start > timeout) reject(err);
        else setTimeout(tick, 0);
      }
    };
    tick();
  });
}
