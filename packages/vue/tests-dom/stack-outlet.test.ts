import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import { provideLayerClient, StackOutlet, StackSubscribe } from "../src/index";

function ConfirmDialog(
  props: LayerComponentProps<{ title: string; message: string }, boolean>,
) {
  return h("div", { role: "dialog", "aria-label": props.payload.title }, [
    h("h2", props.payload.title),
    h("p", props.payload.message),
    h("button", { type: "button", onClick: () => props.call.end(true) }, "Yes"),
    h("button", { type: "button", onClick: () => props.call.end(false) }, "No"),
  ]);
}

const confirmOptions = layerOptions<
  { title: string; message: string },
  boolean
>({
  stack: "confirm",
  key: ["confirm", "remove-export"],
  component: ConfirmDialog,
  exitingDelay: 0,
});

const modalOptionsNoComponent = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "no-component"],
  exitingDelay: 0,
});

function createOutletHost(client: LayerClient, stack = "confirm") {
  return defineComponent({
    setup() {
      provideLayerClient(client);
      return () => h(StackOutlet, { stack });
    },
  });
}

describe("Vue adapter — StackOutlet", () => {
  it("renders on open and removes on close", async () => {
    const client = new LayerClient();
    const wrapper = mount(createOutletHost(client));

    const pending = client.open({
      ...confirmOptions,
      payload: { title: "Remove export", message: "Are you sure?" },
    });

    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Are you sure?");

    await wrapper.get("button").trigger("click");
    await expect(pending).resolves.toBe(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("StackOutlet dev-warns on missing component", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LayerClient();
    const wrapper = mount(createOutletHost(client, "modal"));

    void client.open({
      ...modalOptionsNoComponent,
      payload: { title: "No component" },
    });

    await nextTick();
    await flushPromises();

    const warnMessage = warnSpy.mock.calls.find(([msg]) =>
      String(msg).includes("[layers/vue]"),
    );
    expect(warnMessage).toBeTruthy();
    expect(String(warnMessage?.[0])).toContain("No component for layer");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);

    warnSpy.mockRestore();
  });
});

describe("Vue adapter — StackSubscribe", () => {
  it("renders the selected value through the default scoped slot", async () => {
    const client = new LayerClient();
    const Host = defineComponent({
      setup() {
        provideLayerClient(client);
        return () =>
          h(
            StackSubscribe,
            {
              stack: "s",
              selector: (states) => states.length,
            },
            {
              default: ({ value }: { value: number }) =>
                h("span", { "data-testid": "count" }, String(value)),
            },
          );
      },
    });

    const wrapper = mount(Host);
    await nextTick();
    expect(wrapper.get('[data-testid="count"]').text()).toBe("0");

    void client.open({ key: ["a"], payload: 1, stack: "s" });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe("1");
  });
});
