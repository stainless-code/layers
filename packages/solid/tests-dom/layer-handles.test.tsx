import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import type {
  LayerComponentProps,
  StandardSchemaV1,
} from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { afterEach, describe, expect, it } from "vitest";

import type { WiredLayerHandle, WiredValidatedLayerHandle } from "../src/index";
import {
  LayerClientContext,
  useLayer,
  useLayerQueuedState,
  useLayerState,
  useQueuedStack,
  useStack,
} from "../src/index";

afterEach(() => {
  cleanup();
});

function Toast(props: LayerComponentProps<{ msg: string }, void>) {
  return <div data-testid="toast">{props.payload.msg}</div>;
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

describe("Solid adapter — layer handles", () => {
  it("useLayer open/dismiss/update/state/queued/top/current", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<{ msg: string }, void>;

    render(() => (
      <LayerClientContext.Provider value={client}>
        <HandleProbe
          client={client}
          onReady={(h) => {
            handle = h;
          }}
        />
      </LayerClientContext.Provider>
    ));

    expect(handle.state()).toHaveLength(0);
    expect(handle.top()).toBeNull();
    expect(handle.current).toBeNull();

    void handle.open({ msg: "hello" });
    await waitFor(() =>
      expect(screen.getByTestId("state-len").textContent).toBe("1"),
    );
    expect(screen.getByTestId("top-msg").textContent).toBe("hello");
    expect(handle.current).not.toBeNull();
    expect(handle.client).toBe(client);
    expect(handle.stack).toBe(client.getStack("default"));

    handle.update({ msg: "updated" });
    await waitFor(() =>
      expect(screen.getByTestId("top-msg").textContent).toBe("updated"),
    );

    await handle.dismiss(undefined as void);
    await waitFor(() =>
      expect(screen.getByTestId("state-len").textContent).toBe("0"),
    );
    expect(handle.current).toBeNull();
  });

  it("useLayer open without spread and void payload optionality", async () => {
    const client = new LayerClient();
    let handle!: WiredLayerHandle<void, boolean>;

    render(() => (
      <LayerClientContext.Provider value={client}>
        <VoidProbe
          client={client}
          onReady={(h) => {
            handle = h;
          }}
        />
      </LayerClientContext.Provider>
    ));

    const pending = handle.open();
    await handle.dismiss(true);
    expect(await pending).toBe(true);
  });

  it("useLayer client escape via trailing client arg", async () => {
    const client = new LayerClient();

    function EscapeProbe() {
      const handle = useLayer(toastOptions, client);
      return (
        <div>
          <span data-testid="client-same">
            {handle.client === client ? "yes" : "no"}
          </span>
          <span data-testid="state-len">{handle.state().length}</span>
        </div>
      );
    }

    render(() => <EscapeProbe />);
    expect(screen.getByTestId("client-same").textContent).toBe("yes");

    void client.open({ ...toastOptions, payload: { msg: "escape" } });
    await waitFor(() =>
      expect(screen.getByTestId("state-len").textContent).toBe("1"),
    );
  });

  it("useLayerState and useLayerQueuedState return arrays with select", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });

    render(() => (
      <LayerClientContext.Provider value={client}>
        <ObserveProbe dupKey={dupOptions.key} />
      </LayerClientContext.Provider>
    ));

    void client.open({ ...dupOptions, payload: { n: 1 } });
    void client.open({ ...dupOptions, payload: { n: 2 } });
    await waitFor(() =>
      expect(screen.getByTestId("queued").textContent).toBe("1"),
    );
    expect(screen.getByTestId("mounted").textContent).toBe("1");
  });

  it("useStack and useQueuedStack options bag with trailing client", async () => {
    const client = new LayerClient();

    function StackProbe() {
      const mounted = useStack(
        { stack: "default", select: (s) => s.length },
        client,
      );
      const queued = useQueuedStack(
        { stack: "default", select: (s) => s.length },
        client,
      );
      return (
        <div>
          <span data-testid="mounted">{mounted()}</span>
          <span data-testid="queued">{queued()}</span>
        </div>
      );
    }

    render(() => <StackProbe />);
    expect(screen.getByTestId("mounted").textContent).toBe("0");
    expect(screen.getByTestId("queued").textContent).toBe("0");

    void client.open({ ...toastOptions, payload: { msg: "a" } });
    await waitFor(() =>
      expect(screen.getByTestId("mounted").textContent).toBe("1"),
    );
  });

  it("two useLayer same-key — dismiss with { id: c.current?.id }", async () => {
    const client = new LayerClient();
    const handles: [
      WiredLayerHandle<{ n: number }, boolean>,
      WiredLayerHandle<{ n: number }, boolean>,
    ] = [] as never;

    function DupProbe() {
      const a = useLayer(dupOptions, client);
      const b = useLayer(dupOptions, client);
      handles[0] = a;
      handles[1] = b;
      return (
        <div>
          <span data-testid="a-len">{a.state().length}</span>
          <span data-testid="b-len">{b.state().length}</span>
        </div>
      );
    }

    render(() => (
      <LayerClientContext.Provider value={client}>
        <DupProbe />
      </LayerClientContext.Provider>
    ));

    const firstPending = handles[0]!.open({ n: 1 });
    void handles[1]!.open({ n: 2 });
    await waitFor(() =>
      expect(screen.getByTestId("a-len").textContent).toBe("2"),
    );

    const firstId = handles[0]!.current?.id;
    expect(firstId).toBeTruthy();
    await handles[0]!.dismiss(true, { id: firstId });
    expect(await firstPending).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId("a-len").textContent).toBe("1"),
    );
    expect(handles[0]!.state()[0]?.payload.n).toBe(2);
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

    function QueueProbe() {
      handleA = useLayer(optsA, client);
      handleB = useLayer(optsB, client);
      return <span data-testid="queued">{handleB.queued().length}</span>;
    }

    render(() => (
      <LayerClientContext.Provider value={client}>
        <QueueProbe />
      </LayerClientContext.Provider>
    ));

    void handleA.open({ n: 1 });
    const pending = handleB.open({ n: 2 });
    await waitFor(() =>
      expect(screen.getByTestId("queued").textContent).toBe("1"),
    );

    expect(handleB.cancelQueued(false)).toBe(true);
    expect(await pending).toBe(false);
    await handleA.dismiss(true);
  });

  it("validated handle stores parsed output in state", async () => {
    const client = new LayerClient();
    let handle!: WiredValidatedLayerHandle<typeof idSchema, unknown>;

    function ValidatedProbe() {
      handle = useLayer(validatedOptions, client);
      return (
        <span data-testid="payload-id">
          {handle.state()[0]?.payload.id ?? "none"}
        </span>
      );
    }

    render(() => (
      <LayerClientContext.Provider value={client}>
        <ValidatedProbe />
      </LayerClientContext.Provider>
    ));

    void handle.open({ id: "42" });
    await waitFor(() =>
      expect(screen.getByTestId("payload-id").textContent).toBe("42"),
    );
    expect(handle.state()[0]?.payload).toEqual({ id: 42 });
    await handle.dismiss(undefined as void);
  });
});

function HandleProbe(props: {
  client: LayerClient;
  onReady: (handle: WiredLayerHandle<{ msg: string }, void>) => void;
}) {
  const handle = useLayer(toastOptions, props.client);
  props.onReady(handle);
  return (
    <div>
      <span data-testid="state-len">{handle.state().length}</span>
      <span data-testid="queued-len">{handle.queued().length}</span>
      <span data-testid="top-msg">{handle.top()?.payload.msg ?? "none"}</span>
      <span data-testid="current-id">{handle.current?.id ?? "none"}</span>
    </div>
  );
}

function VoidProbe(props: {
  client: LayerClient;
  onReady: (handle: WiredLayerHandle<void, boolean>) => void;
}) {
  const handle = useLayer(voidOptions, props.client);
  props.onReady(handle);
  return null;
}

function ObserveProbe(props: { dupKey: typeof dupOptions.key }) {
  const mounted = useLayerState({
    key: props.dupKey,
    select: (states) => states.map((s) => (s.payload as { n: number }).n),
  });
  const queued = useLayerQueuedState({
    key: props.dupKey,
    select: (states) => states.length,
  });
  return (
    <div>
      <span data-testid="mounted">{mounted().join(",")}</span>
      <span data-testid="queued">{queued()}</span>
    </div>
  );
}
