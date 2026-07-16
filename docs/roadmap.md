# Roadmap

Forward-looking work only — not a mirror of `src/`. Shipped features live in [`architecture.md`](./architecture.md) + [`glossary.md`](./glossary.md). Pull requests welcome; open an issue first for anything below so we can agree on shape.

## Robustness

- **Devtools** — `@stainless-code/layers-devtools` stack inspector; also owns the public `StackNotifyEvent` event bus. Design-first, once the public API is stable (co-design the event schema against the inspector's real needs); fires the architecture-priming rule (new subpath entry + core/UI split).
- **`#dispatch` reducer** — route every `LayerStack` mutation through one internal transition choke point; unlocks the devtools event stream. Do alongside Devtools.

## Backlog (grill before building)

- **Multi-TypeScript type-test matrix** — run `.test-d` across TS versions in CI to guard the inference surface (DataTag / overloads). Low effort, high ROI.
- **Infer `D` from `loadFn`** — type a layer's `data` from the `loadFn` return without an explicit generic. Needs a dedicated type pass (interacts with the `const Key` inference).
- **`initialSnapshot` (SSR rehydration)** — seed a stack so layers render server-side and hydrate (layers are client-only today; the `transition` axis would hydrate as `settled`).
- **Thenable `.status`** — expose a layer / `open` promise that React Suspense can read.
- **`open` rate-limiting** — optional throttle/debounce on layer opens.

## Adapters

- **Qwik** + **Alpine** + **Lit** + **Marko** + **Angular SSR** + **React Native** bindings if demand materializes.
- A **`HostAdapter`** contract is deliberately **not** planned — `StackOutlet` renders inline; consumers wrap it in their own `createPortal` if they need a portal target. Keeping the core agnostic means no host/portal abstraction baked in.

## Docs site (`apps/docs/`, Blume)

- **MCP server + Ask AI** — require `deployment.output: "server"` + a deploy adapter + API key + rate limits on `/api/ask`. `llms.txt` / `llms-full.txt` / per-page `.md` mirrors / `agent-readability.json` already cover the static agent surface.
- **`<Component>`/`examples/` consolidation** — collapse the React (and optionally Vue/Svelte) live-demo slice onto Blume's native `<Component path=…>` (live preview + source tabs from one file); keep Solid/Preact/Angular as `?raw` code tabs. Large restructure; defer until the recipe matrix stabilizes.

## Out of scope

- Sidecar / nested-portal hosting, route masking, and z-order management — these are consumer concerns, not core. Re-evaluate only if a real consumer needs them and the agnostic contract can express it without leaking library- or framework-specific details.
