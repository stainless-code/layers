# Roadmap

Forward-looking work only — not a mirror of `src/`. Shipped features live in [`architecture.md`](./architecture.md) + [`glossary.md`](./glossary.md). Pull requests welcome; open an issue first for anything below so we can agree on shape.

## Robustness

- **[Devtools + `#dispatch`](./plans/devtools-dispatch.md)** — thin `#dispatch` + `subscribeNotify` / `StackNotifyEvent`; Solid panel + React doorbell. Plan **In progress**.

## Backlog (grill before building)

- **Devtools framework doorbells** — Vue/Solid/… thin packages mirroring `react-layers-devtools` (after React MVP).
- **Devtools bus commands / time-travel** — EventClient bidirectional + recorder (live-ref actions cover v1).
- **`LayerStack.setOptions`** — mutate `scope`/`gcTime`/`dismissAllMode` post-construction so `handle.stack.setOptions(...)` works.
- **Multi-TypeScript type-test matrix** — run `.test-d` across TS versions in CI to guard the inference surface (DataTag / overloads). Low effort, high ROI.
- **Infer `D` from `loadFn`** — type a layer's `data` from the `loadFn` return without an explicit generic. Needs a dedicated type pass (interacts with the `const Key` inference).
- **`initialSnapshot` (SSR rehydration)** — seed a stack so layers render server-side and hydrate (layers are client-only today; the `transition` axis would hydrate as `settled`).
- **Thenable `.status`** — expose a layer / `open` promise that React Suspense can read.
- **`open` rate-limiting** — optional throttle/debounce on layer opens.

## Adapters

- **Qwik** + **Marko** + **Angular SSR** bindings if demand materializes.
- A **`HostAdapter`** contract is deliberately **not** planned — `StackOutlet` renders inline; consumers wrap it in their own `createPortal` / RN `Modal` / root host if they need a different target. Keeping the core agnostic means no host/portal abstraction baked in. React Native uses `@stainless-code/react-layers` (no separate package); mount patterns are on the React adapter docs.

## Docs site (`apps/docs/`, Blume)

- **MCP server + Ask AI** — require `deployment.output: "server"` + a deploy adapter + API key + rate limits on `/api/ask`. `llms.txt` / `llms-full.txt` / per-page `.md` mirrors / `agent-readability.json` already cover the static agent surface.
- **`<Component>`/`examples/` consolidation** — collapse the React (and optionally Vue/Svelte) live-demo slice onto Blume's native `<Component path=…>` (live preview + source tabs from one file); keep Solid/Preact/Angular as `?raw` code tabs. Large restructure; defer until the recipe matrix stabilizes.

## Out of scope

- Sidecar / nested-portal hosting, route masking, and z-order management — these are consumer concerns, not core. Re-evaluate only if a real consumer needs them and the agnostic contract can express it without leaking library- or framework-specific details.
