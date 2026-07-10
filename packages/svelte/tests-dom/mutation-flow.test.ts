import { LayerClient } from "@stainless-code/layers";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import ConfirmStackHost from "./ConfirmStackHost.svelte";
import { saveOptions } from "./layers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Svelte adapter — useMutationFlow (runes)", () => {
  it("toggles flow.pending in the DOM across run().orEnd()", async () => {
    const client = new LayerClient();
    render(ConfirmStackHost, { props: { client } });

    const pending = client.open({
      ...saveOptions,
      payload: { title: "Save export" },
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("pending").textContent).toBe("no");
    expect(screen.getByTestId("status").textContent).toBe("idle");

    fireEvent.click(screen.getByText("Save"));
    await tick();

    expect(screen.getByTestId("pending").textContent).toBe("yes");
    expect(screen.getByTestId("status").textContent).toBe("running");

    await pending;
    await tick();

    // The layer ends on success, so its component (and the pending span) unmount.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
