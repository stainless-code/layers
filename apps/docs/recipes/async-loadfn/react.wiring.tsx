import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

interface Profile {
  name: string;
  role: string;
}

function ProfileLayer({
  payload,
  data,
  phase,
}: LayerComponentProps<{ userId: string }, void, never, Profile>) {
  if (phase === "pending" || data === undefined) {
    return <div>Loading {payload.userId}…</div>;
  }
  return (
    <div>
      <span>{data.name}</span>
      <span>{data.role}</span>
    </div>
  );
}

const profile = layerOptions<{ userId: string }, void, never, Profile>({
  stack: "example-async-loadfn",
  key: ["example-async-loadfn"],
  component: ProfileLayer,
  loadFn: async ({ payload }) => {
    const res = await fetch(`/api/users/${payload.userId}`);
    return (await res.json()) as Profile;
  },
});

function Trigger() {
  const client = useLayerClient();
  const open = () => {
    void client.open({ ...profile, payload: { userId: "ada" } });
  };
  return <button onClick={open}>Open async dialog</button>;
}

export default function AsyncLoadFnWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-async-loadfn" />
      <Trigger />
    </StackProvider>
  );
}
