import {
  LayerClient,
  layerOptions,
  StackProvider,
  StackOutlet,
} from "@stainless-code/preact-layers";
import type { LayerComponentProps } from "@stainless-code/preact-layers";
import { useState } from "preact/hooks";

const layerClient = new LayerClient();

function GuardDialog({
  call,
  payload,
}: LayerComponentProps<{ destination: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true">
      <h2>Leave this page?</h2>
      <p>
        Unsaved changes may be lost. Navigate to{" "}
        <strong>{payload.destination}</strong>?
      </p>
      <div>
        <button type="button" onClick={() => void call.end(false)}>
          Stay
        </button>
        <button type="button" onClick={() => void call.end(true)}>
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
  const [result, setResult] = useState<string | null>(null);

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
      {result !== null && <span>Result: {result}</span>}
    </div>
  );
}

export default function App() {
  return (
    <StackProvider client={layerClient}>
      <StackOutlet stack="example-route-guard" />
      <Trigger />
    </StackProvider>
  );
}
