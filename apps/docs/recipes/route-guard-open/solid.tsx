import {
  layerOptions,
  LayerClient,
  LayerClientContext,
  StackOutlet,
} from "@stainless-code/solid-layers";
import type { LayerComponentProps } from "@stainless-code/solid-layers";
import { createSignal } from "solid-js";

const layerClient = new LayerClient();

function GuardDialog(
  props: LayerComponentProps<{ destination: string }, boolean>,
) {
  return (
    <div role="dialog" aria-modal="true">
      <h2>Leave this page?</h2>
      <p>
        Unsaved changes may be lost. Navigate to{" "}
        <strong>{props.payload.destination}</strong>?
      </p>
      <div>
        <button type="button" onClick={() => void props.call.end(false)}>
          Stay
        </button>
        <button type="button" onClick={() => void props.call.end(true)}>
          Leave
        </button>
      </div>
    </div>
  );
}

const guard = layerOptions<{ destination: string }, boolean>({
  stack: "example-route-guard",
  key: ["example-route-guard"],
  component: GuardDialog,
});

async function simulateNavigation(destination: string): Promise<string> {
  const ok = await layerClient.open({
    ...guard,
    payload: { destination },
  });
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

function Trigger() {
  const [result, setResult] = createSignal<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const message = await simulateNavigation("/settings");
          setResult(message);
        }}
      >
        Simulate navigation
      </button>
      {result() !== null && <span>Result: {result()}</span>}
    </div>
  );
}

export default function App() {
  return (
    <LayerClientContext.Provider value={layerClient}>
      <StackOutlet stack="example-route-guard" />
      <Trigger />
    </LayerClientContext.Provider>
  );
}
