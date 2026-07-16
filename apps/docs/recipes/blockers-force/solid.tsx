import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal, Show, onMount, onCleanup } from "solid-js";

function DiscardConfirm(
  props: LayerComponentProps<{ title: string; message: string }, boolean>,
) {
  return (
    <div role="alertdialog" aria-modal="true">
      <h3>{props.payload.title}</h3>
      <p>{props.payload.message}</p>
      <div>
        <button type="button" onClick={() => void props.call.end(false)}>
          Cancel
        </button>
        <button type="button" onClick={() => void props.call.end(true)}>
          Discard
        </button>
      </div>
    </div>
  );
}

const discardConfirm = layerOptions<
  { title: string; message: string },
  boolean
>({
  key: ["example-blockers-force", "discard"],
  component: DiscardConfirm,
});

function EditDialog(props: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(props.call, { name: "discard" });
  const [text, setText] = createSignal("");

  onMount(() => {
    onCleanup(props.call.addBlocker(() => text().length === 0));
  });

  const attemptClose = async () => {
    if (text().length === 0) {
      props.call.end(false);
      return;
    }
    const discard = await group.open({
      ...discardConfirm,
      payload: {
        title: "Discard changes?",
        message: "You'll lose your unsaved edits.",
      },
    });
    if (discard) props.call.end(false, { force: true });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={props.payload.title}>
      <h2>{props.payload.title}</h2>
      <input
        type="text"
        value={text()}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder="Type to make the form dirty…"
      />
      <Show when={props.dismissing}>
        <p>blocker consulted → vetoed</p>
      </Show>
      <div>
        <button type="button" onClick={() => void attemptClose()}>
          Close
        </button>
        <button
          type="button"
          onClick={() => props.call.end(true, { force: true })}
        >
          Force close
        </button>
      </div>
      <group.Outlet />
    </div>
  );
}

const edit = layerOptions<{ title: string }, boolean>({
  stack: "example-blockers-force",
  key: ["example-blockers-force", "parent"],
  component: EditDialog,
});

const layerClient = new LayerClient();

function Trigger() {
  const client = useLayerClient();
  const [result, setResult] = createSignal<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const ok = await client.open({
            ...edit,
            payload: { title: "Edit profile" },
          });
          setResult(ok);
        }}
      >
        Open form
      </button>
      <Show when={result() !== null}>
        <span>Result: {String(result())}</span>
      </Show>
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={layerClient}>
      <StackOutlet stack="example-blockers-force" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
