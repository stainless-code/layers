import { describe, expect, it } from "bun:test";

import { layersDevtoolsNoOpPlugin, layersDevtoolsPlugin } from "./plugin";

describe("layersDevtoolsPlugin", () => {
  it("returns a TanStack plugin descriptor", () => {
    const plugin = layersDevtoolsPlugin();
    expect(plugin.name).toBe("TanStack Layers");
    expect(typeof plugin.render).toBe("function");
  });

  it("accepts a client override without changing plugin name", () => {
    const plugin = layersDevtoolsPlugin({
      client: { getStackIds: () => [] } as never,
    });
    expect(plugin.name).toBe("TanStack Layers");
    expect(typeof plugin.render).toBe("function");
  });

  it("exposes a no-op plugin factory", () => {
    const plugin = layersDevtoolsNoOpPlugin();
    expect(plugin.name).toBe("TanStack Layers");
    expect(typeof plugin.render).toBe("function");
  });
});
