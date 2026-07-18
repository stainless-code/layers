import {
  Header,
  MainPanel,
  Section,
  SectionDescription,
  Select,
  useTheme,
} from "@tanstack/devtools-ui";
import type { TanStackDevtoolsTheme } from "@tanstack/devtools-ui";
import { createMemo, Show } from "solid-js";

import { brandTokens } from "../brand";
import {
  useLayersDevtoolsStore,
  useSetSelectedStackId,
} from "../LayersContextProvider";
import { LayersLogo } from "./LayersLogo";
import { StackActions } from "./StackActions";
import { StackTable } from "./StackTable";

interface ShellProps {
  theme: TanStackDevtoolsTheme;
}

function EmptyState() {
  const { theme } = useTheme();
  const t = createMemo(() => brandTokens(theme()));

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "min-height": "320px",
        height: "100%",
        padding: "2rem",
        "box-sizing": "border-box",
        background: t().background,
      }}
    >
      <div
        style={{
          "max-width": "28rem",
          "text-align": "center",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          gap: "0.75rem",
        }}
      >
        <LayersLogo theme={theme()} size={40} />
        <h2
          style={{
            margin: 0,
            "font-size": "1.25rem",
            "font-weight": 600,
            color: t().foreground,
          }}
        >
          No stacks yet
        </h2>
        <p
          style={{
            margin: 0,
            "font-size": "0.9rem",
            "line-height": 1.5,
            color: t().mutedForeground,
          }}
        >
          Open a layer from your app, or mount{" "}
          <code
            style={{
              "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
              "font-size": "0.8rem",
              color: t().accent,
            }}
          >
            attachLayerDevtools(client)
          </code>{" "}
          on a LayerClient to inspect live stack state here.
        </p>
        <Section
          style={{
            width: "100%",
            "margin-top": "0.75rem",
            "text-align": "left",
          }}
        >
          <SectionDescription style={{ margin: 0 }}>
            Tip: named stacks (modal, toast, wizard) appear as soon as{" "}
            <code>ensureStack</code> / <code>open</code> runs.
          </SectionDescription>
        </Section>
      </div>
    </div>
  );
}

export function Shell(props: ShellProps) {
  const store = useLayersDevtoolsStore();
  const setSelectedStackId = useSetSelectedStackId();
  const t = createMemo(() => brandTokens(props.theme));

  const stackOptions = createMemo(() =>
    store.stackIds.map((stackId) => ({
      value: stackId,
      label: stackId,
    })),
  );

  const selectedSnapshot = createMemo(() => {
    const id = store.selectedStackId;
    if (!id) {
      return null;
    }
    return store.snapshotsByStackId[id]?.event ?? null;
  });

  // MainPanel drops unknown props (no ...rest) — brand colors go on an inner shell.
  const selectedStackValue = createMemo(
    () => store.selectedStackId ?? store.stackIds[0] ?? "",
  );

  return (
    <MainPanel>
      <div
        style={{
          background: t().background,
          color: t().foreground,
          "min-height": "100%",
          "box-sizing": "border-box",
        }}
      >
        <Header
          style={{
            "border-bottom": `1px solid ${t().border}`,
            "background-color": t().background,
          }}
        >
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "0.65rem",
            }}
          >
            <LayersLogo theme={props.theme} size={22} />
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                gap: "0.1rem",
              }}
            >
              <span
                style={{
                  "font-size": "0.65rem",
                  "font-weight": 600,
                  "letter-spacing": "0.08em",
                  "text-transform": "uppercase",
                  color: t().mutedForeground,
                }}
              >
                Stainless Code
              </span>
              <span
                style={{
                  "font-size": "1.05rem",
                  "font-weight": 700,
                  color: t().foreground,
                  "line-height": 1.1,
                }}
              >
                Layers
              </span>
            </div>
          </div>
        </Header>
        <Show when={store.stackIds.length > 0} fallback={<EmptyState />}>
          <div style={{ padding: "0.75rem", "box-sizing": "border-box" }}>
            {/* TanStack Select is uncontrolled after mount — remount when selection resets. */}
            <Show when={selectedStackValue()} keyed>
              {(value) => (
                <Select
                  label="Stack"
                  options={stackOptions()}
                  value={value}
                  onChange={(next) => setSelectedStackId(String(next))}
                />
              )}
            </Show>
            <Show
              when={selectedSnapshot()}
              keyed
              fallback={
                <SectionDescription style={{ margin: "0.75rem 0 0" }}>
                  Waiting for stack updates…
                </SectionDescription>
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
          </div>
        </Show>
      </div>
    </MainPanel>
  );
}
