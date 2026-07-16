import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
  useLayerClient,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal, Show } from "solid-js";

interface Profile {
  name: string;
  role: string;
  initials: string;
}

function ProfileDialog(
  props: LayerComponentProps<{ userId: string }, void, never, Profile>,
) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Profile ${props.payload.userId}`}
    >
      <Show when={props.phase !== "pending"} fallback={<p>Loading profile…</p>}>
        <div>
          <h2>{props.data?.name}</h2>
          <p>{props.data?.role}</p>
          <span>{props.data?.initials}</span>
        </div>
      </Show>
      <button type="button" onClick={() => void props.call.dismiss()}>
        Close
      </button>
    </div>
  );
}

const profile = layerOptions<{ userId: string }, void, never, Profile>({
  stack: "example-async-loadfn",
  key: ["example-async-loadfn"],
  component: ProfileDialog,
  loadFn: async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      name: "Ada Lovelace",
      role: "Founding Engineer",
      initials: "AL",
    };
  },
});

const layerClient = new LayerClient();

function Trigger() {
  const client = useLayerClient();
  const [phase, setPhase] = createSignal<"idle" | "loading" | "done">("idle");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setPhase("loading");
          void client
            .open({ ...profile, payload: { userId: "ada" } })
            .then(() => setPhase("done"));
        }}
      >
        Open async dialog
      </button>
      <Show when={phase() !== "idle"}>
        <span>{phase() === "loading" ? "Loading…" : "Closed"}</span>
      </Show>
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={layerClient}>
      <StackOutlet stack="example-async-loadfn" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
