import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import {
  attachLayerDevtools,
  softDismissTop,
} from "@stainless-code/layers-devtools";
import { StackOutlet, StackProvider } from "@stainless-code/react-layers";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

function ProbeDialog({
  call,
  payload,
}: LayerComponentProps<{ title: string }, void>) {
  return (
    <div role="dialog" aria-label={payload.title}>
      <h2>{payload.title}</h2>
      <button type="button" onClick={() => call.end()}>
        Close
      </button>
    </div>
  );
}

const probeOptions = layerOptions<{ title: string }, void>({
  stack: "confirm",
  key: ["confirm", "devtools-probe"],
  component: ProbeDialog,
  exitingDelay: 0,
});

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

describe("React Devtools — soft dismiss after attach", () => {
  it("attachLayerDevtools + softDismissTop clears the stack snapshot", async () => {
    const client = new LayerClient();
    render(<App client={client} />);

    const pending = client.open({
      ...probeOptions,
      payload: { title: "Devtools probe" },
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(client.getStack("confirm").getSnapshot()).toHaveLength(1);

    const detach = attachLayerDevtools(client);
    try {
      const result = softDismissTop(client, "confirm");
      expect(result).not.toBe(false);
      await result;
      await pending;

      await waitFor(() =>
        expect(client.getStack("confirm").getSnapshot()).toHaveLength(0),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    } finally {
      detach();
    }
  });
});
