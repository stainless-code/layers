import type {
  LayerComponentProps,
  StandardSchemaV1,
} from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import type { WiredLayerHandle, WiredValidatedLayerHandle } from "../src/index";
import {
  provideLayerClient,
  useLayer,
  useLayerQueuedState,
  useLayerState,
  useQueuedStack,
  useStack,
} from "../src/index";

function Toast({
  call: _call,
  payload,
}: LayerComponentProps<{ msg: string }, void>) {
  return h("div", { "data-testid": "toast" }, payload.msg);
}

const toastOptions = layerOptions<{ msg: string }, void>({
  stack: "default",
  key: ["toast"],
  component: Toast,
  exitingDelay: 0,
});

const dupOptions = layerOptions<{ n: number }, boolean>({
  stack: "default",
  key: ["dup"],
  component: undefined,
  exitingDelay: 0,
});

const voidOptions = layerOptions<void, boolean>({
  stack: "default",
  key: ["void"],
  component: undefined,
  exitingDelay: 0,
});

const idSchema = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (v: unknown) => ({
      value: { id: Number((v as { id: string }).id) },
    }),
    types: undefined as unknown as {
      input: { id: string };
      output: { id: number };
    },
  },
} as StandardSchemaV1<{ id: string }, { id: number }>;

const validatedOptions = {
  stack: "default",
  key: ["v"],
  validate: idSchema,
  component: undefined,
  exitingDelay: 0,
};

describe("Vue adapter — layer handles", () => {
  it("useLayer open/dismiss/update/state/queued/top/current", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<{ msg: string }, void>;

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        handle = useLayer(toastOptions, client);
        return () =>
          h("div", [
            h(
              "span",
              { "data-testid": "state-len" },
              handle.state.value.length,
            ),
            h(
              "span",
              { "data-testid": "queued-len" },
              handle.queued.value.length,
            ),
            h(
              "span",
              { "data-testid": "top-msg" },
              handle.top.value?.payload.msg ?? "none",
            ),
            h(
              "span",
              { "data-testid": "current-id" },
              handle.current?.id ?? "none",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe);

    expect(handle.state.value).toHaveLength(0);
    expect(handle.top.value).toBeNull();
    expect(handle.current).toBeNull();

    void handle.open({ msg: "hello" });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="state-len"]').text()).toBe("1");
    expect(wrapper.get('[data-testid="top-msg"]').text()).toBe("hello");
    expect(handle.current).not.toBeNull();
    expect(handle.client).toBe(client);
    expect(handle.stack).toBe(client.getStack("default"));

    handle.update({ msg: "updated" });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="top-msg"]').text()).toBe("updated");

    await handle.dismiss(undefined as void);
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="state-len"]').text()).toBe("0");
    expect(handle.current).toBeNull();
  });

  it("useLayer open without spread and void payload optionality", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<void, boolean>;

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        handle = useLayer(voidOptions, client);
        return () => null;
      },
    });

    mount(Probe);

    const pending = handle.open();
    await handle.dismiss(true);
    expect(await pending).toBe(true);
  });

  it("useLayer client escape via trailing client arg", async () => {
    const client = new LayerClient();

    const Probe = defineComponent({
      setup() {
        const handle = useLayer(toastOptions, client);
        return () =>
          h("div", [
            h(
              "span",
              { "data-testid": "client-same" },
              handle.client === client ? "yes" : "no",
            ),
            h(
              "span",
              { "data-testid": "state-len" },
              handle.state.value.length,
            ),
          ]);
      },
    });

    const wrapper = mount(Probe);
    expect(wrapper.get('[data-testid="client-same"]').text()).toBe("yes");

    void client.open({ ...toastOptions, payload: { msg: "escape" } });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="state-len"]').text()).toBe("1");
  });

  it("useLayerState and useLayerQueuedState return arrays with select", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        const mounted = useLayerState(
          {
            key: dupOptions.key,
            select: (states) =>
              states.map((s) => (s.payload as { n: number }).n),
          },
          client,
        );
        const queued = useLayerQueuedState(
          {
            key: dupOptions.key,
            select: (states) => states.length,
          },
          client,
        );
        return () =>
          h("div", [
            h("span", { "data-testid": "mounted" }, mounted.value.join(",")),
            h("span", { "data-testid": "queued" }, queued.value),
          ]);
      },
    });

    const wrapper = mount(Probe);

    void client.open({ ...dupOptions, payload: { n: 1 } });
    void client.open({ ...dupOptions, payload: { n: 2 } });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="queued"]').text()).toBe("1");
    expect(wrapper.get('[data-testid="mounted"]').text()).toBe("1");
  });

  it("useStack and useQueuedStack options bag with trailing client", async () => {
    const client = new LayerClient();

    const Probe = defineComponent({
      setup() {
        const mounted = useStack(
          { stack: "default", select: (s) => s.length },
          client,
        );
        const queued = useQueuedStack(
          { stack: "default", select: (s) => s.length },
          client,
        );
        return () =>
          h("div", [
            h("span", { "data-testid": "mounted" }, mounted.value),
            h("span", { "data-testid": "queued" }, queued.value),
          ]);
      },
    });

    const wrapper = mount(Probe);
    expect(wrapper.get('[data-testid="mounted"]').text()).toBe("0");
    expect(wrapper.get('[data-testid="queued"]').text()).toBe("0");

    void client.open({ ...toastOptions, payload: { msg: "a" } });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="mounted"]').text()).toBe("1");
  });

  it("two useLayer same-key — dismiss with { id: c.current?.id }", async () => {
    const client = new LayerClient();
    const handles: [
      WiredLayerHandle<{ n: number }, boolean>,
      WiredLayerHandle<{ n: number }, boolean>,
    ] = [] as never;

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        const a = useLayer(dupOptions, client);
        const b = useLayer(dupOptions, client);
        handles[0] = a;
        handles[1] = b;
        return () =>
          h("div", [
            h("span", { "data-testid": "a-len" }, a.state.value.length),
            h("span", { "data-testid": "b-len" }, b.state.value.length),
          ]);
      },
    });

    const wrapper = mount(Probe);

    const firstPending = handles[0]!.open({ n: 1 });
    void handles[1]!.open({ n: 2 });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="a-len"]').text()).toBe("2");

    const firstId = handles[0]!.current?.id;
    expect(firstId).toBeTruthy();
    await handles[0]!.dismiss(true, { id: firstId });
    expect(await firstPending).toBe(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="a-len"]').text()).toBe("1");
    expect(handles[0]!.state.value[0]?.payload.n).toBe(2);
  });

  it("useLayer cancelQueued resolves queued layer", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const optsA = layerOptions<{ n: number }, boolean>({ key: ["a"] });
    const optsB = layerOptions<{ n: number }, boolean>({ key: ["b"] });
    let handleA!: WiredLayerHandle<{ n: number }, boolean>;
    let handleB!: WiredLayerHandle<{ n: number }, boolean>;

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        handleA = useLayer(optsA, client);
        handleB = useLayer(optsB, client);
        return () =>
          h("span", { "data-testid": "queued" }, handleB.queued.value.length);
      },
    });

    const wrapper = mount(Probe);

    void handleA.open({ n: 1 });
    const pending = handleB.open({ n: 2 });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="queued"]').text()).toBe("1");

    expect(handleB.cancelQueued(false)).toBe(true);
    expect(await pending).toBe(false);
    await handleA.dismiss(true);
  });

  it("validated handle stores parsed output in state", async () => {
    const client = new LayerClient();
    let handle!: WiredValidatedLayerHandle<typeof idSchema, unknown>;

    const Probe = defineComponent({
      setup() {
        provideLayerClient(client);
        handle = useLayer(validatedOptions, client);
        return () =>
          h(
            "span",
            { "data-testid": "payload-id" },
            handle.state.value[0]?.payload.id ?? "none",
          );
      },
    });

    const wrapper = mount(Probe);

    void handle.open({ id: "42" });
    await nextTick();
    await flushPromises();

    expect(wrapper.get('[data-testid="payload-id"]').text()).toBe("42");
    expect(handle.state.value[0]?.payload).toEqual({ id: 42 });
    await handle.dismiss(undefined as void);
  });
});
