import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";

import {
  createStackHook,
  provideLayerClient,
  StackOutlet,
  useLayerGroup,
  useMutationFlow,
} from "../src/index";
import type { AppLayerProps } from "../src/index";

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let saveDeferred: ReturnType<typeof createDeferred> | null = null;

function SaveDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  const flow = useMutationFlow(props.call);

  return h("div", { role: "dialog", "aria-label": props.payload.title }, [
    h("span", { "data-testid": "status" }, props.actionStatus),
    h(
      "button",
      {
        type: "button",
        onClick: () =>
          void flow
            .run(async () => {
              await saveDeferred!.promise;
            })
            .orEnd(true),
      },
      "Save",
    ),
  ]);
}

const saveOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["save", "export"],
  component: SaveDialog,
  exitingDelay: 0,
});

describe("Vue adapter — useMutationFlow", () => {
  it("drives actionStatus to running, then ends on success", async () => {
    const client = new LayerClient();
    saveDeferred = createDeferred();

    const App = defineComponent({
      setup() {
        provideLayerClient(client);
        return () => h(StackOutlet, { stack: "confirm" });
      },
    });

    const wrapper = mount(App);

    const pending = client.open({
      ...saveOptions,
      payload: { title: "Save export" },
    });

    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="status"]').text()).toBe("idle");

    await wrapper.get("button").trigger("click");
    await nextTick();

    expect(wrapper.get('[data-testid="status"]').text()).toBe("running");

    saveDeferred.resolve();
    await flushPromises();

    await expect(pending).resolves.toBe(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});

const childPending = { current: null as Promise<string> | null };

function ChildDialog(props: LayerComponentProps<{ label: string }, string>) {
  return h("div", { role: "dialog", "aria-label": props.payload.label }, [
    h("p", props.payload.label),
    h(
      "button",
      { type: "button", onClick: () => props.call.end("done") },
      "Done",
    ),
  ]);
}

const childOptions = layerOptions<{ label: string }, string>({
  key: ["drawer", "child"],
  component: ChildDialog,
  exitingDelay: 0,
});

function ParentDrawer(props: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(props.call);
  return h("div", { role: "dialog", "aria-label": props.payload.title }, [
    h("h2", props.payload.title),
    h(
      "button",
      {
        type: "button",
        onClick: () => {
          childPending.current = group.open({
            ...childOptions,
            payload: { label: "Child" },
          });
        },
      },
      "Open child",
    ),
    h(group.Outlet),
    h(
      "button",
      { type: "button", onClick: () => props.call.end(false) },
      "Close",
    ),
  ]);
}

const parentOptions = layerOptions<{ title: string }, boolean>({
  stack: "drawer",
  key: ["drawer", "parent"],
  component: ParentDrawer,
  exitingDelay: 0,
});

describe("Vue adapter — useLayerGroup", () => {
  it("opens a nested layer through group.Outlet", async () => {
    const client = new LayerClient();

    const App = defineComponent({
      setup() {
        provideLayerClient(client);
        return () => h(StackOutlet, { stack: "drawer" });
      },
    });

    const wrapper = mount(App);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"][aria-label="Parent"]').exists()).toBe(
      true,
    );

    await wrapper.get("button").trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"][aria-label="Child"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("Child");
  });

  it("auto-drains the child stack when the parent is dismissed", async () => {
    const client = new LayerClient();

    const App = defineComponent({
      setup() {
        provideLayerClient(client);
        return () => h(StackOutlet, { stack: "drawer" });
      },
    });

    const wrapper = mount(App);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await nextTick();
    await flushPromises();

    const openChildBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Open child")!;
    await openChildBtn.trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"][aria-label="Child"]').exists()).toBe(
      true,
    );

    const closeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Close")!;
    await closeBtn.trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"][aria-label="Child"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[role="dialog"][aria-label="Parent"]').exists()).toBe(
      false,
    );
  });

  it("resolves group.open when the child layer ends", async () => {
    const client = new LayerClient();
    childPending.current = null;

    const App = defineComponent({
      setup() {
        provideLayerClient(client);
        return () => h(StackOutlet, { stack: "drawer" });
      },
    });

    const wrapper = mount(App);

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await nextTick();
    await flushPromises();

    const openChildBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Open child")!;
    await openChildBtn.trigger("click");
    await nextTick();
    await flushPromises();

    const doneBtn = wrapper.findAll("button").find((b) => b.text() === "Done")!;
    await doneBtn.trigger("click");
    await flushPromises();

    await expect(childPending.current).resolves.toBe("done");
  });
});

function ModalDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  return h("div", { role: "dialog", "aria-label": props.payload.title }, [
    h("h2", props.payload.title),
    h(
      "button",
      { type: "button", onClick: () => props.call.end(true) },
      "Confirm",
    ),
  ]);
}

const modalLayerOpts = {
  key: ["modal", "settings"],
  component: ModalDialog,
  exitingDelay: 0,
};

describe("Vue adapter — createStackHook", () => {
  it("useAppStack.open binds the stack", async () => {
    const client = new LayerClient();
    const { StackProvider, useAppStack, AppHost } = createStackHook({
      stack: "modal",
    });
    let pending: Promise<boolean> | undefined;

    const Trigger = defineComponent({
      setup() {
        const { open } = useAppStack();
        return () =>
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                pending = open({
                  ...modalLayerOpts,
                  payload: { title: "Settings" },
                });
              },
            },
            "Open",
          );
      },
    });

    const App = defineComponent({
      setup() {
        return () =>
          h(StackProvider, { client }, () => [h(AppHost), h(Trigger)]);
      },
    });

    const wrapper = mount(App);

    await wrapper.get("button").trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Settings");
    expect(client.getStack("modal").getSnapshot()).toHaveLength(1);
    expect(pending).toBeDefined();

    const confirmBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Confirm")!;
    await confirmBtn.trigger("click");
    await flushPromises();

    await expect(pending!).resolves.toBe(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });

  it("AppHost applies Host chrome", async () => {
    const client = new LayerClient();
    const { StackProvider, AppHost } = createStackHook({
      stack: "modal",
      Host: defineComponent({
        setup(_, { slots }) {
          return () => h("div", { "data-testid": "chrome" }, slots.default?.());
        },
      }),
    });

    const App = defineComponent({
      setup() {
        return () => h(StackProvider, { client }, () => h(AppHost));
      },
    });

    const wrapper = mount(App);
    await nextTick();

    expect(wrapper.find('[data-testid="chrome"]').exists()).toBe(true);
  });

  it("AppLayer controlled open/close", async () => {
    const client = new LayerClient();
    const onResolved = vi.fn();
    const { StackProvider, AppHost, AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "settings"],
      component: ModalDialog,
      exitingDelay: 0,
    } satisfies Omit<
      AppLayerProps<{ title: string }, boolean>["options"],
      never
    >;

    const ControlledLayer = defineComponent({
      setup() {
        const open = ref(false);
        return () => [
          h(
            "button",
            { type: "button", onClick: () => (open.value = true) },
            "Show",
          ),
          h(
            "button",
            { type: "button", onClick: () => (open.value = false) },
            "Hide",
          ),
          h(AppLayer, {
            options: layerOpts,
            open: open.value,
            payload: { title: "Controlled" },
            onResolved,
          }),
        ];
      },
    });

    const App = defineComponent({
      setup() {
        return () =>
          h(StackProvider, { client }, () => [h(AppHost), h(ControlledLayer)]);
      },
    });

    const wrapper = mount(App);

    const showBtn = wrapper.findAll("button").find((b) => b.text() === "Show")!;
    await showBtn.trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Controlled");

    const confirmBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Confirm")!;
    await confirmBtn.trigger("click");
    await flushPromises();

    expect(onResolved).toHaveBeenCalledWith(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("AppLayer dismisses when open flips true to false", async () => {
    const client = new LayerClient();
    const { StackProvider, AppHost, AppLayer } = createStackHook({
      stack: "modal",
    });

    const layerOpts = {
      key: ["modal", "dismiss-test"],
      component: ModalDialog,
      exitingDelay: 0,
    };

    const ControlledLayer = defineComponent({
      setup() {
        const open = ref(false);
        return () => [
          h(
            "button",
            { type: "button", onClick: () => (open.value = true) },
            "Show",
          ),
          h(
            "button",
            { type: "button", onClick: () => (open.value = false) },
            "Hide",
          ),
          h(AppLayer, {
            options: layerOpts,
            open: open.value,
            payload: { title: "Dismiss me" },
          }),
        ];
      },
    });

    const App = defineComponent({
      setup() {
        return () =>
          h(StackProvider, { client }, () => [h(AppHost), h(ControlledLayer)]);
      },
    });

    const wrapper = mount(App);

    const showBtn = wrapper.findAll("button").find((b) => b.text() === "Show")!;
    await showBtn.trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    const hideBtn = wrapper.findAll("button").find((b) => b.text() === "Hide")!;
    await hideBtn.trigger("click");
    await nextTick();
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(client.getStack("modal").getSnapshot()).toHaveLength(0);
  });
});
