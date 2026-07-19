import type { DismissAllMode, LayerClient } from "@stainless-code/layers";
import { Button, Select } from "@tanstack/devtools-ui";
import { createSignal } from "solid-js";

import {
  cancelQueuedHead,
  dismissAllWithMode,
  forceClearStack,
  forceDismissTop,
  softDismissTop,
} from "../live-actions";
import { getAttachedLayerClient } from "../live-client";

const DISMISS_ALL_MODES: DismissAllMode[] = [
  "skipBlocked",
  "stopAtBlocked",
  "force",
];

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
        "align-items": "flex-end",
        "margin-top": "0.75rem",
        "margin-bottom": "0.75rem",
      }}
    >
      <Button
        variant="secondary"
        disabled={!props.hasActive}
        onClick={() =>
          withClient((client) => {
            void softDismissTop(client, props.stackId);
          })
        }
      >
        Soft dismiss
      </Button>
      <Button
        variant="warning"
        disabled={!props.hasQueued}
        onClick={() =>
          withClient((client) => {
            cancelQueuedHead(client, props.stackId);
          })
        }
      >
        Cancel queued
      </Button>
      <Button
        variant="danger"
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
      </Button>
      <Select
        label="dismissAll mode"
        options={DISMISS_ALL_MODES.map((mode) => ({
          value: mode,
          label: mode,
        }))}
        value={dismissAllMode()}
        onChange={(value) => setDismissAllMode(value as DismissAllMode)}
      />
      <Button
        variant="primary"
        disabled={!props.hasActive && !props.hasQueued}
        onClick={() =>
          withClient((client) => {
            void dismissAllWithMode(client, props.stackId, dismissAllMode());
          })
        }
      >
        Dismiss all
      </Button>
      <Button
        variant="danger"
        disabled={!props.hasActive && !props.hasQueued}
        onClick={() =>
          withClient((client) => {
            if (
              !globalThis.confirm(
                "Force clear this stack? Open callers reject with LayerCancelledError (not a dismiss response).",
              )
            ) {
              return;
            }
            void forceClearStack(client, props.stackId);
          })
        }
      >
        Force clear
      </Button>
    </div>
  );
}
