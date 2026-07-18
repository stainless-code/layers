import type {
  LayerActionStatus,
  LayerNotifyView,
  LayerPhase,
  LayerTransition,
} from "@stainless-code/layers";
import {
  JsonTree,
  Section,
  SectionDescription,
  SectionTitle,
  Tag,
  useTheme,
} from "@tanstack/devtools-ui";
import type { ComponentProps } from "solid-js";
import { createMemo, For, Show } from "solid-js";

import { brandTokens } from "../brand";

type TagColor = ComponentProps<typeof Tag>["color"];

function phaseTagColor(phase: LayerPhase): TagColor {
  switch (phase) {
    case "active": {
      return "green";
    }
    case "queued": {
      return "yellow";
    }
    case "pending": {
      return "blue";
    }
    case "dismissed": {
      return "gray";
    }
    case "error": {
      return "red";
    }
  }
}

function transitionTagColor(transition: LayerTransition): TagColor {
  switch (transition) {
    case "entering": {
      return "cyan";
    }
    case "settled": {
      return "gray";
    }
    case "exiting": {
      return "purple";
    }
  }
}

function actionStatusTagColor(status: LayerActionStatus): TagColor {
  switch (status) {
    case "running": {
      return "pink";
    }
    case "idle": {
      return "gray";
    }
  }
}

function formatPayloadFallback(layer: LayerNotifyView): string {
  if (layer.payloadTruncated) {
    return "[truncated]";
  }
  if (layer.payload === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(layer.payload, null, 0);
  } catch {
    return "[unserializable]";
  }
}

function canShowJsonTree(layer: LayerNotifyView): boolean {
  if (layer.payloadTruncated || layer.payload === undefined) {
    return false;
  }
  return typeof layer.payload === "object" && layer.payload !== null;
}

function LayerTable(props: { title: string; rows: LayerNotifyView[] }) {
  const { theme } = useTheme();
  const tableStyles = createMemo(() => {
    const t = brandTokens(theme());
    return {
      border: t.border,
      headerBg: t.headerBg,
    };
  });

  return (
    <Section style={{ "margin-bottom": "1rem" }}>
      <SectionTitle>
        {props.title} <Tag color="gray" label={String(props.rows.length)} />
      </SectionTitle>
      <Show
        when={props.rows.length > 0}
        fallback={<SectionDescription>Empty</SectionDescription>}
      >
        <div style={{ overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              "border-collapse": "collapse",
              "font-size": "0.75rem",
              border: `1px solid ${tableStyles().border}`,
            }}
          >
            <thead>
              <tr
                style={{
                  "background-color": tableStyles().headerBg,
                  "border-bottom": `1px solid ${tableStyles().border}`,
                }}
              >
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  phase
                </th>
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  transition
                </th>
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  actionStatus
                </th>
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  id
                </th>
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  key
                </th>
                <th
                  style={{
                    "text-align": "left",
                    padding: "0.375rem 0.5rem",
                  }}
                >
                  payload
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(layer) => (
                  <tr
                    style={{
                      "border-bottom": `1px solid ${tableStyles().border}`,
                    }}
                  >
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                      }}
                    >
                      <Tag
                        color={phaseTagColor(layer.phase)}
                        label={layer.phase}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                      }}
                    >
                      <Tag
                        color={transitionTagColor(layer.transition)}
                        label={layer.transition}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                      }}
                    >
                      <Tag
                        color={actionStatusTagColor(layer.actionStatus)}
                        label={layer.actionStatus}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                        "font-family": "monospace",
                      }}
                    >
                      {layer.id}
                    </td>
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                      }}
                    >
                      {layer.key}
                    </td>
                    <td
                      style={{
                        padding: "0.375rem 0.5rem",
                        "vertical-align": "top",
                        "max-width": "16rem",
                      }}
                    >
                      <Show
                        when={canShowJsonTree(layer)}
                        fallback={
                          <span
                            style={{
                              "font-family": "monospace",
                              "word-break": "break-all",
                            }}
                          >
                            {formatPayloadFallback(layer)}
                          </span>
                        }
                      >
                        <JsonTree
                          value={layer.payload}
                          defaultExpansionDepth={1}
                        />
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </Section>
  );
}

export function StackTable(props: {
  active: LayerNotifyView[];
  queued: LayerNotifyView[];
  action: string | null;
  seq: number | null;
}) {
  return (
    <div>
      <Show when={props.action !== null}>
        <SectionDescription style={{ margin: "0 0 0.75rem" }}>
          Last action: <Tag color="teal" label={props.action ?? ""} />
          <Show when={props.seq !== null}> · seq {props.seq}</Show>
        </SectionDescription>
      </Show>
      <LayerTable title="Active" rows={props.active} />
      <LayerTable title="Queued" rows={props.queued} />
    </div>
  );
}
