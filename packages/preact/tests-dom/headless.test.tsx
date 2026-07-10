import { LayerClient, layerOptions } from "@stainless-code/layers";
import {
  StackOutlet,
  StackProvider,
  useStackHandles,
} from "@stainless-code/preact-layers";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

const modalOptions = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "headless"],
  exitingDelay: 0,
});

const modalOptionsNoComponent = layerOptions<{ title: string }, boolean>({
  stack: "modal",
  key: ["modal", "no-component"],
  exitingDelay: 0,
});

/** Headless host: custom buttons instead of registered layer components. */
function HeadlessHost() {
  const { states, getCall } = useStackHandles("modal");
  return (
    <>
      {states.map((s) => (
        <button key={s.id} type="button" onClick={() => getCall(s).end(true)}>
          Close {String(s.payload)}
        </button>
      ))}
    </>
  );
}

function HeadlessApp({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <HeadlessHost />
    </StackProvider>
  );
}

function OutletApp({ client }: { client: LayerClient }) {
  return (
    <StackProvider client={client}>
      <StackOutlet stack="modal" />
    </StackProvider>
  );
}

describe("Preact adapter — headless render", () => {
  it("useStackHandles renders custom components", async () => {
    const client = new LayerClient();
    render(<HeadlessApp client={client} />);

    const pending = client.open({
      ...modalOptions,
      payload: { title: "Headless modal" },
    });

    const button = await screen.findByRole("button", {
      name: /Close \[object Object\]/,
    });
    expect(button).toBeTruthy();

    fireEvent.click(button);

    await expect(pending).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("StackOutlet dev-warns on missing component", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new LayerClient();
    render(<OutletApp client={client} />);

    void client.open({
      ...modalOptionsNoComponent,
      payload: { title: "No component" },
    });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });

    const warnMessage = warnSpy.mock.calls.find(([msg]) =>
      String(msg).includes("[layers/preact]"),
    );
    expect(warnMessage).toBeTruthy();
    expect(String(warnMessage?.[0])).toContain("No component for layer");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    warnSpy.mockRestore();
  });
});
