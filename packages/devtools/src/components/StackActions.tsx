import type { DismissAllMode, LayerClient } from "@stainless-code/layers";
import { createSignal, For } from "solid-js";

import {
  cancelQueuedHead,
  dismissAllWithMode,
  forceDismissTop,
  softDismissTop,
} from "../live-actions";
import { getAttachedLayerClient } from "../live-client";

const DISMISS_ALL_MODES: DismissAllMode[] = [
  "skipBlocked",
  "stopAtBlocked",
  "force",
];

const buttonStyle = {
  "font-size": "0.75rem",
  padding: "0.25rem 0.5rem",
  cursor: "pointer",
} as const;

export function StackActions(props: {
  stackId: string;
  hasActive: boolean;
  hasQueued: boolean;
}) {
  const [dismissAllMode, setDismissAllMode] =
    createSignal<DismissAllMode>("skipBlocked");

  const withClient = (run: (client: LayerClient) => void) => {
    const client = getAttachedLayerClient();
    if (!client) {
      return;
    }
    run(client);
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-wrap": "wrap",
        gap: "0.5rem",
        "align-items": "center",
        "margin-bottom": "0.75rem",
      }}
    >
      <button
        type="button"
        style={buttonStyle}
        disabled={!props.hasActive}
        onClick={() =>
          withClient((client) => {
            void softDismissTop(client, props.stackId);
          })
        }
      >
        Soft dismiss
      </button>
      <button
        type="button"
        style={buttonStyle}
        disabled={!props.hasQueued}
        onClick={() =>
          withClient((client) => {
            cancelQueuedHead(client, props.stackId);
          })
        }
      >
        Cancel queued
      </button>
      <button
        type="button"
        style={buttonStyle}
        disabled={!props.hasActive}
        onClick={() =>
          withClient((client) => {
            if (
              !globalThis.confirm(
                "Force dismiss the top layer? This bypasses blockers.",
              )
            ) {
              return;
            }
            void forceDismissTop(client, props.stackId);
          })
        }
      >
        Force dismiss
      </button>
      <label
        style={{
          display: "inline-flex",
          "align-items": "center",
          gap: "0.35rem",
          "font-size": "0.75rem",
        }}
      >
        dismissAll
        <select
          value={dismissAllMode()}
          onChange={(e) =>
            setDismissAllMode(e.currentTarget.value as DismissAllMode)
          }
        >
          <For each={DISMISS_ALL_MODES}>
            {(mode) => <option value={mode}>{mode}</option>}
          </For>
        </select>
        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            withClient((client) => {
              void dismissAllWithMode(client, props.stackId, dismissAllMode());
            })
          }
        >
          Run
        </button>
      </label>
    </div>
  );
}
