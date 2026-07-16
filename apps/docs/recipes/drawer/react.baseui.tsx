import { Drawer } from "@base-ui/react/drawer";
import {
  layerOptions,
  StackOutlet,
  StackProvider,
  useLayerClient,
} from "@stainless-code/react-layers";
import type { LayerComponentProps } from "@stainless-code/react-layers";
// Base UI variant of the drawer example (inline CSS).
// Static recipe — source shown via `?raw`; not rendered live.
// Strategy A: controlled `open` -> onOpenChange -> onOpenChangeComplete -> call.end,
// so Base UI's exit animation finishes before Layers unmounts the layer.
import { useRef, useState } from "react";

function DrawerLayer({
  call,
  payload,
}: LayerComponentProps<{ title: string }, boolean>) {
  const [open, setOpen] = useState(true);
  const resultRef = useRef<boolean | undefined>(undefined);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (resultRef.current === undefined) resultRef.current = false;
          setOpen(false);
        }
      }}
      onOpenChangeComplete={(o) => {
        if (!o) call.end(resultRef.current ?? false);
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Viewport>
          <Drawer.Popup>
            <Drawer.Content>
              <Drawer.Title>{payload.title}</Drawer.Title>
              <p>
                Edit your settings here. Save or cancel to close the drawer.
              </p>
              <div>
                <Drawer.Close
                  onClick={() => {
                    resultRef.current = false;
                  }}
                >
                  Cancel
                </Drawer.Close>
                <Drawer.Close
                  onClick={() => {
                    resultRef.current = true;
                  }}
                >
                  Save
                </Drawer.Close>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const drawer = layerOptions<{ title: string }, boolean>({
  stack: "example-drawer",
  key: ["example-drawer"],
  component: DrawerLayer,
});

function Trigger() {
  const client = useLayerClient();
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          setResult(null);
          const saved = await client.open({
            ...drawer,
            payload: { title: "Settings" },
          });
          setResult(saved);
        }}
      >
        Open drawer
      </button>
      {result !== null && <span>Result: {String(result)}</span>}
    </div>
  );
}

export default function DrawerExample() {
  return (
    <StackProvider>
      <StackOutlet stack="example-drawer" />
      <Trigger />
    </StackProvider>
  );
}
