import { LayerClient } from "@stainless-code/layers";
import { render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import type { WiredLayerHandle } from "../src/index";
import DupProbe from "./DupProbe.svelte";
import HandleProbe from "./HandleProbe.svelte";
import { dupOptions, toastOptions } from "./layers-handles";
import ObserveProbe from "./ObserveProbe.svelte";
import QueueProbe from "./QueueProbe.svelte";
import StackProbe from "./StackProbe.svelte";
import ValidatedProbe from "./ValidatedProbe.svelte";
import VoidProbe from "./VoidProbe.svelte";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Svelte runes — layer handles", () => {
  it("createLayer open/dismiss/update/state/queued/top/current", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<{ msg: string }, void>;

    const { getByTestId } = render(HandleProbe, {
      props: {
        client,
        onReady: (h) => {
          handle = h;
        },
      },
    });
    await tick();

    expect(handle.state).toHaveLength(0);
    expect(handle.top).toBeNull();
    expect(handle.current).toBeNull();

    void handle.open({ msg: "hello" });
    await waitFor(() => expect(getByTestId("state-len").textContent).toBe("1"));
    expect(getByTestId("top-msg").textContent).toBe("hello");
    expect(handle.current).not.toBeNull();
    expect(handle.client).toBe(client);
    expect(handle.stack).toBe(client.getStack("default"));

    handle.update({ msg: "updated" });
    await waitFor(() =>
      expect(getByTestId("top-msg").textContent).toBe("updated"),
    );

    await handle.dismiss(undefined as void);
    await waitFor(() => expect(getByTestId("state-len").textContent).toBe("0"));
    expect(handle.current).toBeNull();
  });

  it("createLayer open without spread and void payload optionality", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<void, boolean>;

    render(VoidProbe, {
      props: {
        client,
        onReady: (h) => {
          handle = h;
        },
      },
    });
    await tick();

    const pending = handle.open();
    await handle.dismiss(true);
    expect(await pending).toBe(true);
  });

  it("createLayerState and createLayerQueuedState return arrays with select", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });

    const { getByTestId } = render(ObserveProbe, {
      props: { client, dupKey: dupOptions.key },
    });
    await tick();

    void client.open({ ...dupOptions, payload: { n: 1 } });
    void client.open({ ...dupOptions, payload: { n: 2 } });
    await waitFor(() => expect(getByTestId("queued").textContent).toBe("1"));
    expect(getByTestId("mounted").textContent).toBe("1");
  });

  it("useStack and createQueuedStack options bag with trailing client", async () => {
    const client = new LayerClient();

    const { getByTestId } = render(StackProbe, { props: { client } });
    await tick();
    expect(getByTestId("mounted").textContent).toBe("0");
    expect(getByTestId("queued").textContent).toBe("0");

    void client.open({ ...toastOptions, payload: { msg: "a" } });
    await waitFor(() => expect(getByTestId("mounted").textContent).toBe("1"));
  });

  it("two createLayer same-key — dismiss with { id: c.current?.id }", async () => {
    const client = new LayerClient();
    let handles!: [
      WiredLayerHandle<{ n: number }, boolean>,
      WiredLayerHandle<{ n: number }, boolean>,
    ];

    const { getByTestId } = render(DupProbe, {
      props: {
        client,
        onReady: (h) => {
          handles = h;
        },
      },
    });
    await tick();

    const firstPending = handles[0].open({ n: 1 });
    void handles[1].open({ n: 2 });
    await waitFor(() => expect(getByTestId("a-len").textContent).toBe("2"));

    const firstId = handles[0].current?.id;
    expect(firstId).toBeTruthy();
    await handles[0].dismiss(true, { id: firstId });
    expect(await firstPending).toBe(true);
    await waitFor(() => expect(getByTestId("a-len").textContent).toBe("1"));
    expect(handles[0].state[0]?.payload.n).toBe(2);
  });

  it("createLayer cancelQueued resolves queued layer", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    let handleA!: WiredLayerHandle<{ n: number }, boolean>;
    let handleB!: WiredLayerHandle<{ n: number }, boolean>;

    const { getByTestId } = render(QueueProbe, {
      props: {
        client,
        onReady: ({ handleA: a, handleB: b }) => {
          handleA = a;
          handleB = b;
        },
      },
    });
    await tick();

    void handleA.open({ n: 1 });
    const pending = handleB.open({ n: 2 });
    await waitFor(() => expect(getByTestId("queued").textContent).toBe("1"));

    expect(handleB.cancelQueued(false)).toBe(true);
    expect(await pending).toBe(false);
    await handleA.dismiss(true);
  });

  it("validated handle stores parsed output in state", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<{ id: number }, unknown>;

    const { getByTestId } = render(ValidatedProbe, {
      props: {
        client,
        onReady: (h) => {
          handle = h;
        },
      },
    });
    await tick();

    void handle.open({ id: "42" });
    await waitFor(() =>
      expect(getByTestId("payload-id").textContent).toBe("42"),
    );
    expect(handle.state[0]?.payload).toEqual({ id: 42 });
    await handle.dismiss(undefined as void);
  });
});
