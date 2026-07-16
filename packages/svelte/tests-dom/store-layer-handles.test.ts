import { LayerClient } from "@stainless-code/layers";
import { render, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import type { WiredLayerStoreHandle } from "../src/store";
import StoreHandleProbe from "./StoreHandleProbe.svelte";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Svelte store — layer handles", () => {
  it("createLayer open/dismiss/state/queued/top via stores", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerStoreHandle<{ msg: string }, void>;

    const { getByTestId } = render(StoreHandleProbe, {
      props: {
        client,
        onReady: (h) => {
          handle = h;
        },
      },
    });
    await tick();

    let stateLen = "";
    const unsub = handle.state.subscribe((s) => {
      stateLen = String(s.length);
    });
    expect(stateLen).toBe("0");

    void handle.open({ msg: "hello" });
    await waitFor(() => expect(getByTestId("state-len").textContent).toBe("1"));
    expect(getByTestId("top-msg").textContent).toBe("hello");
    expect(handle.current).not.toBeNull();

    await handle.dismiss(undefined as void);
    await waitFor(() => expect(getByTestId("state-len").textContent).toBe("0"));
    unsub();
  });
});
