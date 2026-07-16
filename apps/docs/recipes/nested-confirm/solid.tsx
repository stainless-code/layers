import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
  useLayerGroup,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal } from "solid-js";

function ChildConfirm(props: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true">
      <h3>{props.payload.title}</h3>
      <div>
        <button type="button" onClick={() => void props.call.end(false)}>
          Cancel
        </button>
        <button type="button" onClick={() => void props.call.end(true)}>
          Confirm
        </button>
      </div>
    </div>
  );
}

const childConfirm = layerOptions<{ title: string }, boolean>({
  key: ["example-nested", "child-confirm"],
  component: ChildConfirm,
});

function ParentDialog(props: LayerComponentProps<{ title: string }, void>) {
  const group = useLayerGroup(props.call);
  const [childResult, setChildResult] = createSignal<boolean | null>(null);

  return (
    <div role="dialog" aria-modal="true" aria-label={props.payload.title}>
      <h2>{props.payload.title}</h2>
      <p>Remove this item from the list?</p>
      <div>
        <button
          type="button"
          onClick={async () => {
            setChildResult(null);
            const ok = await group.open({
              ...childConfirm,
              payload: { title: "Really delete this item?" },
            });
            setChildResult(ok);
          }}
        >
          Delete item
        </button>
        <button type="button" onClick={() => void props.call.dismiss()}>
          Close
        </button>
      </div>
      {childResult() !== null && (
        <span>Child result: {String(childResult())}</span>
      )}
      <group.Outlet />
    </div>
  );
}

const parentDialog = layerOptions<{ title: string }, void>({
  stack: "example-nested",
  key: ["example-nested", "parent"],
  component: ParentDialog,
});

const client = new LayerClient();

function Trigger() {
  const c = useLayerClient();

  return (
    <button
      type="button"
      onClick={() => {
        void c.open({
          ...parentDialog,
          payload: { title: "Edit item" },
        });
      }}
    >
      Open parent dialog
    </button>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={client}>
      <StackOutlet stack="example-nested" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
