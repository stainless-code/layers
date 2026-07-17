import {
  layerOptions,
  StackProvider,
  StackOutlet,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useState } from "react";

interface Profile {
  name: string;
  role: string;
  initials: string;
}

function ProfileDialog({
  call,
  payload,
  data,
  phase,
}: LayerComponentProps<{ userId: string }, void, never, Profile>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Profile ${payload.userId}`}
    >
      {phase === "pending" ? (
        <p>Loading profile…</p>
      ) : (
        <div>
          <h2>{data?.name}</h2>
          <p>{data?.role}</p>
          <span>{data?.initials}</span>
        </div>
      )}
      <button type="button" onClick={() => void call.dismiss()}>
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

function Trigger() {
  const profileLayer = useLayer(profile);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setPhase("loading");
          void profileLayer
            .open({ userId: "ada" })
            .then(() => setPhase("done"));
        }}
      >
        Open async dialog
      </button>
      {phase !== "idle" && (
        <span>{phase === "loading" ? "Loading…" : "Closed"}</span>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider>
      <StackOutlet stack="example-async-loadfn" />
      <Trigger />
    </StackProvider>
  );
}
