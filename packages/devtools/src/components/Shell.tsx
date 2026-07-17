import { Header, HeaderLogo, MainPanel } from "@tanstack/devtools-ui";
import { createMemo, For, Show } from "solid-js";

import {
  useLayersDevtoolsStore,
  useSetSelectedStackId,
} from "../LayersContextProvider";
import { StackActions } from "./StackActions";
import { StackTable } from "./StackTable";

export function Shell() {
  const store = useLayersDevtoolsStore();
  const setSelectedStackId = useSetSelectedStackId();

  const selectedSnapshot = createMemo(() => {
    const id = store.selectedStackId;
    if (!id) {
      return null;
    }
    return store.snapshotsByStackId[id]?.event ?? null;
  });

  return (
    <MainPanel>
      <Header>
        <HeaderLogo flavor={{ light: "#6366f1", dark: "#818cf8" }}>
          TanStack Layers
        </HeaderLogo>
      </Header>
      <div style={{ padding: "0.75rem", "box-sizing": "border-box" }}>
        <Show
          when={store.stackIds.length > 0}
          fallback={
            <p style={{ margin: 0, opacity: 0.75, "font-size": "0.875rem" }}>
              No stacks yet. Open a layer or mount{" "}
              <code>attachLayerDevtools</code> on a LayerClient.
            </p>
          }
        >
          <label
            style={{
              display: "flex",
              "align-items": "center",
              gap: "0.5rem",
              "margin-bottom": "0.75rem",
              "font-size": "0.8125rem",
            }}
          >
            Stack
            <select
              value={store.selectedStackId ?? ""}
              onChange={(e) => setSelectedStackId(e.currentTarget.value)}
              style={{ "min-width": "8rem" }}
            >
              <For each={store.stackIds}>
                {(stackId) => <option value={stackId}>{stackId}</option>}
              </For>
            </select>
          </label>
          <Show
            when={selectedSnapshot()}
            keyed
            fallback={
              <p style={{ margin: 0, opacity: 0.75, "font-size": "0.875rem" }}>
                Waiting for stack updates…
              </p>
            }
          >
            {(snapshot) => (
              <>
                <Show when={store.selectedStackId}>
                  {(stackId) => (
                    <StackActions
                      stackId={stackId()}
                      hasActive={snapshot.active.length > 0}
                      hasQueued={snapshot.queued.length > 0}
                    />
                  )}
                </Show>
                <StackTable
                  active={snapshot.active}
                  queued={snapshot.queued}
                  action={snapshot.action}
                  seq={snapshot.seq}
                />
              </>
            )}
          </Show>
        </Show>
      </div>
    </MainPanel>
  );
}
