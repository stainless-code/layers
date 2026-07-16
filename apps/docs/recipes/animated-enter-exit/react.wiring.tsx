import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayer,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";

function AnimatedLayer({
  call,
  payload,
  transition,
}: LayerComponentProps<{ title: string }, void>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={payload.title}
      data-transition={transition}
      onTransitionEnd={() => {
        // settle finishes the phase once the CSS transition ends
        if (transition === "entering" || transition === "exiting")
          call.settle();
      }}
    >
      <button onClick={() => call.dismiss()}>Close</button>
    </div>
  );
}

const animated = layerOptions<{ title: string }, void>({
  stack: "example-animated",
  key: ["example-animated"],
  component: AnimatedLayer,
  enteringDelay: 200,
  exitingDelay: 200,
});

function Trigger() {
  const animatedLayer = useLayer(animated);
  const open = () => animatedLayer.open({ title: "Animated dialog" });
  return <button onClick={open}>Open animated dialog</button>;
}

export default function AnimatedWiring() {
  return (
    <StackProvider>
      <StackOutlet stack="example-animated" />
      <Trigger />
    </StackProvider>
  );
}
