import type { LayerNotifyView } from "@stainless-code/layers";
import { For, Show } from "solid-js";

function formatPayload(layer: LayerNotifyView): string {
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

function LayerTable(props: { title: string; rows: LayerNotifyView[] }) {
  return (
    <section style={{ "margin-bottom": "1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem", "font-size": "0.875rem" }}>
        {props.title} ({props.rows.length})
      </h3>
      <Show
        when={props.rows.length > 0}
        fallback={
          <p style={{ margin: "0", opacity: "0.7", "font-size": "0.8125rem" }}>
            Empty
          </p>
        }
      >
        <div style={{ overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              "border-collapse": "collapse",
              "font-size": "0.75rem",
            }}
          >
            <thead>
              <tr>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>
                  phase
                </th>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>
                  transition
                </th>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>
                  actionStatus
                </th>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>id</th>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>
                  key
                </th>
                <th style={{ "text-align": "left", padding: "0.25rem" }}>
                  payload
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={props.rows}>
                {(layer) => (
                  <tr>
                    <td style={{ padding: "0.25rem", "vertical-align": "top" }}>
                      {layer.phase}
                    </td>
                    <td style={{ padding: "0.25rem", "vertical-align": "top" }}>
                      {layer.transition}
                    </td>
                    <td style={{ padding: "0.25rem", "vertical-align": "top" }}>
                      {layer.actionStatus}
                    </td>
                    <td
                      style={{
                        padding: "0.25rem",
                        "vertical-align": "top",
                        "font-family": "monospace",
                      }}
                    >
                      {layer.id}
                    </td>
                    <td style={{ padding: "0.25rem", "vertical-align": "top" }}>
                      {layer.key}
                    </td>
                    <td
                      style={{
                        padding: "0.25rem",
                        "vertical-align": "top",
                        "font-family": "monospace",
                        "max-width": "12rem",
                        "word-break": "break-all",
                      }}
                    >
                      {formatPayload(layer)}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </section>
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
        <p
          style={{
            margin: "0 0 0.75rem",
            "font-size": "0.8125rem",
            opacity: "0.85",
          }}
        >
          Last action: <code>{props.action}</code>
          <Show when={props.seq !== null}> · seq {props.seq}</Show>
        </p>
      </Show>
      <LayerTable title="Active" rows={props.active} />
      <LayerTable title="Queued" rows={props.queued} />
    </div>
  );
}
