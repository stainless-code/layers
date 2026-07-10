import { LayerClient } from "@stainless-code/layers";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import { storeSaveOptions } from "./layers";
import StoreConfirmStackHost from "./StoreConfirmStackHost.svelte";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Svelte adapter — useMutationFlow (store)", () => {
  it("toggles $pending across run().orEnd()", async () => {
    const client = new LayerClient();
    render(StoreConfirmStackHost, { props: { client } });

    const pending = client.open({
      ...storeSaveOptions,
      payload: { title: "Save export" },
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("pending").textContent).toBe("no");

    fireEvent.click(screen.getByText("Save"));
    await tick();

    expect(screen.getByTestId("pending").textContent).toBe("yes");

    await pending;
    await tick();

    // The layer ends on success, so its component (and the pending span) unmount.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
