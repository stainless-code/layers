import type { LayerComponentProps } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import {
  StackOutlet,
  StackProvider,
  useMutationFlow,
} from "@stainless-code/react-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});

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

/** Save dialog that runs an async mutation before ending. */
function SaveDialog({
  call,
  payload,
  actionStatus,
}: LayerComponentProps<{ title: string }, boolean>) {
  const flow = useMutationFlow(call);

  return (
    <div role="dialog" aria-label={payload.title}>
      <span data-testid="status">{actionStatus}</span>
      <button
        type="button"
        onClick={() =>
          void flow
            .run(async () => {
              await saveDeferred!.promise;
            })
            .orEnd(true)
        }
      >
        Save
      </button>
    </div>
  );
}

const saveOptions = layerOptions<{ title: string }, boolean>({
  stack: "confirm",
  key: ["save", "export"],
  component: SaveDialog,
  exitingDelay: 0,
});

function App({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="confirm" />
    </StackProvider>
  );
}

describe("React adapter — useMutationFlow", () => {
  it("drives actionStatus to running, then ends on success", async () => {
    const client = new LayerClient();
    saveDeferred = createDeferred();
    render(<App client={client} />);

    const pending = client.open({
      ...saveOptions,
      payload: { title: "Save export" },
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("status").textContent).toBe("idle");

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("running"),
    );

    saveDeferred.resolve();
    await Promise.resolve();

    await expect(pending).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
