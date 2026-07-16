import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
  useLayerGroup,
} from "@stainless-code/preact-layers";
import type { LayerComponentProps } from "@stainless-code/preact-layers";
import { useEffect, useState } from "preact/hooks";

function DiscardConfirm({
  call,
  payload,
}: LayerComponentProps<{ title: string; message: string }, boolean>) {
  return (
    <div role="alertdialog" aria-modal="true">
      <h3>{payload.title}</h3>
      <p>{payload.message}</p>
      <div>
        <button type="button" onClick={() => void call.end(false)}>
          Cancel
        </button>
        <button type="button" onClick={() => void call.end(true)}>
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

function EditDialog({
  call,
  payload,
  dismissing,
}: LayerComponentProps<{ title: string }, boolean>) {
  const group = useLayerGroup(call, { name: "discard" });
  const [text, setText] = useState("");
  const dirty = text.length > 0;

  useEffect(() => call.addBlocker(() => !dirty), [call, dirty]);

  const attemptClose = async () => {
    if (!dirty) {
      call.end(false);
      return;
    }
    const discard = await group.open({
      ...discardConfirm,
      payload: {
        title: "Discard changes?",
        message: "You'll lose your unsaved edits.",
      },
    });
    if (discard) call.end(false, { force: true });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={payload.title}>
      <h2>{payload.title}</h2>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder="Type to make the form dirty…"
      />
      {dismissing && <p>blocker consulted → vetoed</p>}
      <div>
        <button type="button" onClick={() => void attemptClose()}>
          Close
        </button>
        <button type="button" onClick={() => call.end(true, { force: true })}>
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

function Trigger() {
  const editLayer = useLayer(edit);
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const ok = await editLayer.open({ title: "Edit profile" });
          setResult(ok);
        }}
      >
        Open form
      </button>
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-blockers-force" />
      <Trigger />
    </StackProvider>
  );
}
