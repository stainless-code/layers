import type { StackNotifyEvent } from "@stainless-code/layers";
import type { JSX } from "solid-js";
import { createContext, createEffect, onCleanup, useContext } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { layersEventClient } from "./event-client";

interface StackSnapshot {
  event: StackNotifyEvent;
}

interface LayersDevtoolsStore {
  stackIds: string[];
  selectedStackId: string | null;
  snapshotsByStackId: Record<string, StackSnapshot>;
}

const initialLayersDevtoolsStore: LayersDevtoolsStore = {
  stackIds: [],
  selectedStackId: null,
  snapshotsByStackId: {},
};

const LayersDevtoolsContext = createContext<
  [LayersDevtoolsStore, (fn: (draft: LayersDevtoolsStore) => void) => void]
>([initialLayersDevtoolsStore, () => {}]);

export function LayersContextProvider(props: { children: JSX.Element }) {
  const [store, setStore] = createStore<LayersDevtoolsStore>(
    initialLayersDevtoolsStore,
  );

  createEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      layersEventClient.on("stack-registry", (e) => {
        const stackIds = e.payload.stackIds;
        setStore(
          produce((draft) => {
            draft.stackIds = stackIds;
            if (
              draft.selectedStackId !== null &&
              !stackIds.includes(draft.selectedStackId)
            ) {
              draft.selectedStackId = stackIds[0] ?? null;
            } else if (draft.selectedStackId === null && stackIds.length > 0) {
              draft.selectedStackId = stackIds[0] ?? null;
            }
          }),
        );
      }),
    );

    cleanups.push(
      layersEventClient.on("stack-state", (e) => {
        const event = e.payload;
        setStore(
          produce((draft) => {
            draft.snapshotsByStackId[event.stackId] = { event };
            if (!draft.stackIds.includes(event.stackId)) {
              draft.stackIds.push(event.stackId);
            }
            if (draft.selectedStackId === null) {
              draft.selectedStackId = event.stackId;
            }
          }),
        );
      }),
    );

    onCleanup(() => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  });

  return (
    <LayersDevtoolsContext.Provider
      value={[store, (fn) => setStore(produce(fn))]}
    >
      {props.children}
    </LayersDevtoolsContext.Provider>
  );
}

export function useLayersDevtoolsStore(): LayersDevtoolsStore {
  const [store] = useContext(LayersDevtoolsContext);
  return store;
}

export function useSetSelectedStackId(): (stackId: string) => void {
  const [, setStore] = useContext(LayersDevtoolsContext);
  return (stackId: string) => {
    setStore(
      produce((draft) => {
        draft.selectedStackId = stackId;
      }),
    );
  };
}
