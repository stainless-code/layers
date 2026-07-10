# Good and bad tests (this repo)

Loaded from [`tdd`](./SKILL.md). Two runners — pick by whether the behavior needs a DOM (see `docs/architecture.md` § Test matrix).

## Good tests

Integration-style through the **public seams** (`LayerClient.open`, `LayerStack`, `layerOptions`, `useStack`/`StackOutlet`):

```ts
import { describe, expect, it } from "bun:test";
import { LayerClient } from "./layerClient";
import { layerOptions } from "./layerOptions";
import { LayerStack } from "./layerStack";

describe("LayerClient.open", () => {
  it("resolves the caller's await when the layer is dismissed", async () => {
    const client = new LayerClient();
    const confirm = layerOptions<{ n: number }, boolean>({
      stack: "confirm",
      key: ["confirm", "x"],
    });
    const pending = client.open({ ...confirm, payload: { n: 1 } });
    const stack = client.getStack("confirm") as unknown as LayerStack<
      { n: number },
      boolean
    >;
    const layer = stack.find(["confirm", "x"]);
    stack.dismiss(layer!, true);
    expect(await pending).toBe(true);
  });
});
```

Characteristics:

- Observable behavior callers care about (open, dismiss, phase, scope queueing, gcTime restore)
- Public seam only — `LayerClient.open` / `LayerStack` / `layerOptions` / `useStack`
- Survives internal refactors of `packages/core/src/`
- One logical assertion per test

## Bad tests

```ts
// BAD: mocks an internal helper of packages/core/src
vi.mock("./internal-scheduler", () => ({ flush: () => {} }));

// BAD: asserts call order on a private queue
expect(internalScopeQueue.shift).toHaveBeenCalledBefore(notify);

// BAD: reaches past the seam — reads the Layer's private #state
expect(layer.#state.phase).toBe("active");

// BAD: assumes one outer batch emits one notification per mutation
expect(listener).toHaveBeenCalledTimes(2); // batch dedupes listener calls
```

Red flags: mocking own modules under `packages/*/src/`, testing private helpers, call-count assertions, tests that break on a rename-only refactor, assuming one outer `notifyManager.batch` emits one notification per mutation.

## Mock boundaries

Mock at the **framework module seam** in adapter tests only:

- **OK to fake** — the framework module an adapter binds (`solid-js` → client build, `@angular/core` stub, `preact/compat` stub) so `bun:test` can exercise the binding without a real renderer; a real reactive scope for Vue (`effectScope`) / Solid (`createRoot`); `AbortController` signals in `loadFn` tests.
- **Don't mock** — `packages/core/src/` internals; the real `LayerStack` (exercise it directly); framework subscribe hooks (use the real adapter via `packages/*/tests-dom/` + that adapter's testing library).

```ts
// GOOD: fake the framework module, exercise the real adapter + core
mock.module("solid-js", () => import("solid-js/dist/solid.js"));
mock.module("@angular/core", () => ({ signal: ..., effect: ... }));
```

Designing for mockability: the package seam already isolates `packages/core` from every framework peer — adapter tests stub or scope the framework module, core tests use a real `LayerClient`/`LayerStack` with no framework at all. Package manifests, `sherif`, and workspace-aware `knip` pin import isolation.

## DOM / component tests (`packages/*/tests-dom/`)

Test what a consumer sees through the adapter's render surface (`StackOutlet`, `renderStack`, `useStack().current`, etc.), not framework internals. React example:

```tsx
// GOOD: behavior through the outlet — render, interact, await the open() promise
render(
  <StackProvider client={client}>
    <StackOutlet stack="confirm" />
  </StackProvider>,
);
const pending = client.open({ ...confirm, payload: { title: "Remove?" } });
fireEvent.click(await screen.findByText("Yes"));
await expect(pending).resolves.toBe(true);

// BAD: asserts on internal subscription count
expect(stack.listeners.size).toBe(1);
```
