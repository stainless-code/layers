import {
  LayerClient,
  layerOptions,
  StackOutlet,
  StackProvider,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

const guardClient = new LayerClient();

function GuardLayer({
  call,
  payload,
  transition,
}: LayerComponentProps<{ destination: string }, boolean>) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      data-transition={transition}
      aria-label={`Leave for ${payload.destination}?`}
    >
      <button onClick={() => call.end(true)}>Leave</button>
      <button onClick={() => call.end(false)}>Stay</button>
    </div>
  );
}

const guard = layerOptions<{ destination: string }, boolean>({
  stack: "example-route-guard",
  key: ["example-route-guard"],
  component: GuardLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

async function navigate(destination: string): Promise<string> {
  const ok = await guardClient.open({
    ...guard,
    payload: { destination },
  });
  return ok ? `Navigated to ${destination}` : "Navigation cancelled";
}

function Trigger() {
  const go = async () => {
    const message = await navigate("/settings");
    void message;
  };
  return <button onClick={go}>Simulate navigation</button>;
}

export default function RouteGuardWiring() {
  return (
    <StackProvider client={guardClient}>
      <StackOutlet stack="example-route-guard" />
      <Trigger />
    </StackProvider>
  );
}
