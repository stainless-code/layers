import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

function DrawerLayer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  return (
    <div role="dialog" aria-modal="true" aria-label={payload.title}>
      <button onClick={() => call.end(true)}>Save</button>
      <button onClick={() => call.end(false)}>Cancel</button>
    </div>
  );
}

const drawer = layerOptions<{ title: string }, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: DrawerLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

function Trigger() {
  const client = useLayerClient();
  const open = () => client.open({ ...drawer, payload: { title: "Settings" } });
  return <button onClick={open}>Open drawer</button>;
}

export default function DrawerWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-drawer" />
      <Trigger />
    </StackProvider>
  );
}
