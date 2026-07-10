import { LayerClient } from "@stainless-code/layers";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import DrawerStackHost from "./DrawerStackHost.svelte";
import { childPending, parentOptions } from "./layers";

afterEach(() => {
  document.body.innerHTML = "";
  childPending.current = null;
});

describe("Svelte adapter — useLayerGroup (runes)", () => {
  it("opens a nested layer through group.stack.current", async () => {
    const client = new LayerClient();
    render(DrawerStackHost, { props: { client } });

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await tick();
    expect(await screen.findByRole("dialog", { name: "Parent" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("open-child"));
    await tick();

    expect(await screen.findByRole("dialog", { name: "Child" })).toBeTruthy();
    expect(screen.getByText("Child")).toBeTruthy();
  });

  it("auto-drains the child stack when the parent is dismissed", async () => {
    const client = new LayerClient();
    render(DrawerStackHost, { props: { client } });

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await tick();
    fireEvent.click(await screen.findByTestId("open-child"));
    await tick();
    expect(await screen.findByRole("dialog", { name: "Child" })).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));
    await tick();

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Parent" })).toBeNull(),
    );
  });

  it("resolves group.open when the child layer ends", async () => {
    const client = new LayerClient();
    childPending.current = null;
    render(DrawerStackHost, { props: { client } });

    void client.open({
      ...parentOptions,
      payload: { title: "Parent" },
    });

    await tick();
    fireEvent.click(await screen.findByTestId("open-child"));
    await tick();
    fireEvent.click(await screen.findByText("Done"));

    await expect(childPending.current).resolves.toBe("done");
  });
});
