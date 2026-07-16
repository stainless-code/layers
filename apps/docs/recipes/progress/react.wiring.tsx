import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
import { useEffect } from "react";

function ProgressLayer({
  call,
  payload,
}: LayerComponentProps<
  { fileName: string; percent: number; speedKb: number },
  void
>) {
  const done = payload.percent >= 100;
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => call.dismiss(), 900);
      return () => clearTimeout(t);
    }
    return;
  }, [done, call]);
  return (
    <div>
      <span>{payload.fileName}</span>
      <span>{payload.percent}%</span>
      <span>{payload.speedKb} KB/s</span>
    </div>
  );
}

const progress = layerOptions<
  { fileName: string; percent: number; speedKb: number },
  void
>({
  stack: "example-progress",
  key: ["example-progress"],
  upsert: true,
  component: ProgressLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

function Trigger() {
  const client = useLayerClient();
  const start = () => {
    void client.open({
      ...progress,
      payload: { fileName: "layers-core-1.4.0.tgz", percent: 0, speedKb: 0 },
    });
    const stack = client.getStack("example-progress");
    const layer = stack.find(["example-progress"]);
    if (!layer) return;
    let pct = 0;
    const id = setInterval(() => {
      pct = Math.min(100, pct + Math.round(6 + Math.random() * 8));
      const speed = Math.round((8 + Math.random() * 6) * 10) / 10;
      stack.update(layer, { percent: pct, speedKb: speed } as never);
      stack.setRunning(layer, pct < 100);
      if (pct >= 100) clearInterval(id);
    }, 130);
  };
  return <button onClick={start}>Start upload</button>;
}

export default function ProgressWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-progress" />
      <Trigger />
    </StackProvider>
  );
}
