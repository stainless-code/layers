# `createLayer` + `useLayer` + `useLayerState` — wired layer handles

> **Status:** Design decided (grilled). Spec/plan — not yet implemented.
> **Decision owner:** @sutusebastian · **North star:** framework-agnostic core, type-safe, no vendor lock-in, composable, explicit.

## 1. Decision

Adopt three primitives, a rename, and two queued-observe hooks. No narrowed handle, no library singleton, no same-name supersession, no hidden control flow:

1. **`createLayer(options, client)`** — core factory. Wires **client + stack + identity** and returns identity-bound `open`/`upsert`/`dismiss`/`update`/`cancelQueued` + `client`/`stack`/`options`/`current` escapes (stack-level ops via `.stack`). Headless — no reactive field. For non-UI / explicit / request-scoped clients. **Overload split** plain vs validated (see §4.1).
2. **`useLayer(options, client?)`** — per-adapter hook = `createLayer(options, <acquire client>)` + reactive **array `state: LayerState[]`** (all same-key mounted), **`queued: LayerState[]`** (all same-key queued), **`top: LayerState | null`** (sugar = `state.at(-1) ?? null`). Drive + observe the bound layer. Options-bag + optional trailing `client`. Overload split plain vs validated.
3. **`useLayerState({ key, stack?, select?, compare? }, client?)`** — per-adapter **observe-only** hook (mounted, all same-key). The existing `useLayer(key, stackId?, compare?)` key-subscription hook, **renamed** + reshaped to an options bag returning `LayerState[]`. No control surface.
4. **`useQueuedStack({ stack?, select?, compare? }, client?)`** + **`useLayerQueuedState({ key, stack?, select?, compare? }, client?)`** — per-adapter **queued-observe** hooks (whole-stack + per-key), mirroring core's `getSnapshot`/`getQueuedSnapshot` two-method split. Additive new exports.

`layerOptions` (passive identity), `useLayerClient` (full client), and the **bag form of `LayerClient.open`** are **unchanged**. No `.use()`/`.bind()` on passive objects; no 4-method narrowed handle; no module-global client. **No positional `LayerClient.open` overload** — the handle (`useLayer`/`createLayer`) is the no-spread ergonomic path; low-level `client.open` callers spread (`{...confirm, payload}`), the normal JS pattern (one bag signature, no second calling convention).

**This is a breaking major bump** (experimental — accepted): `useLayer(key, …)` is renamed to `useLayerState({ key, … })`; `useStack` moves to an options bag (`selector` → `select`) and its explicit-client overload is deleted; `useLayer` becomes the wired handle; observe hooks return arrays (was `LayerState | null`); `LayerStack.find` flips to topmost.

**Ethos gate:** core stays headless/agnostic — `createLayer` is core, knows only `LayerClient`/`LayerOptions` · composable — `layerOptions`/`useLayerClient`/`useLayerState`/`useLayerQueuedState`/`useStack`/`useQueuedStack`/bag-form escapes preserved; focused primitives (one hook per source; identity-bound defaults vs call-specific concerns separated) · DX earns its cost — no speculative overload, no `{state,queued}` wrapper tax, no unearned per-call `rest` bag, `useQueuedStack` mirrors core's two-method split rather than a flag toggle · explicit, type-safe — no module-global client; one convention (bag form) across `client.open` + handle ops; no positional-overload second convention; no hidden `mine`-default control; named-`{id}` exact control; live-checked `current`; per-call bags carry (A) call-specific concerns only, not (B) identity-default overrides. **Retired alternatives** (grilled, rejected): `createLayer` as a rename of `layerOptions`; `createLayer.use()`/`.bind()` on a passive object; `useLayer(options)` returning a `{open,dismiss,upsert,update}` subset; whole-stack `states` on the handle; overloading `useLayer` on first-arg shape; same-name replacement of `useLayer(key)`; **a positional `LayerClient.open(opts, payload?, rest?)` overload** (rejected: optional positional object args = the argument-order DX smell resolved elsewhere via single-bag; redundant with the handle's no-spread `open`; a second calling convention on top of the single-bag `client.open`); **`{state, queued}` return on `useStack`** (rejected: second break on top of the major, perf tax on the common case, unsolvable `select`/`compare` semantics, wrapper churn); **`queued?: boolean` toggle on `useStack`** (rejected in favor of (Separate): a flag-branch is less explicit than two named hooks mirroring core's two methods); **(D) instance-bound handle** / instance-owning `mine`-default control (rejected: `mine` is fragile across upsert/gc/queued/self-dismiss/batch; `mine`-default = hidden control flow; the queued-`mine` `dismiss` triggers a `#scopeQueue.shift()` re-commit bug); **(B) singular topmost observe** (rejected in favor of (E-both): singular hides concurrent same-key instances — the honesty problem; array exposes the multi-instance reality); **a per-call `rest?: Partial<PerOpen<…>>` bag on `open`/`upsert`** (rejected: per-call-override principle — per-call bags carry (A) call-specific concerns only, not (B) identity-default overrides; `open`'s would-be `rest` is all (B) identity-bound with 0 real per-call variation; the bag introduced the `undefined`-hole; per-call overrides route to `handle.client.open` bag escape / `c.upsert()`; future earned override is a curated paired field, not a generic `Partial` bag).

## 2. Why the spread existed / how the handle kills it

`LayerClient.open` (layerClient.ts L136–149) reads: `stack, key, payload, component, enteringDelay, exitingDelay, upsert, loadFn, validate`. The spread `{...options, payload}` merged the layer's static identity/config with per-call `payload` + inline overrides into `open`'s single-arg bag.

The spread is killed by the **handle**, not by a second `client.open` signature:

- `useLayer(confirm).open(payload)` / `createLayer(confirm, client).open(payload)` — no spread; identity is bound in the handle, payload is positional. Per-call overrides (rare) route to `handle.client.open({...options, payload, override})` (the low-level bag escape) or `c.upsert(payload)` (the dedicated upsert entry) — see §4.1 for the per-call-override principle.
- `R` infers from `options.key`'s `DataTag`; `P` from the handle's generic (`layerOptions<P, R>`). Same inference engine as the bag form.
- `client.open` keeps its single bag signature (3 type-overloads for inference: validate, DataTag, generic bag — all bag-shaped, one convention). Low-level callers spread; the handle is the ergonomic no-spread path.

## 3. API surface

| API                                                                | Where                               | Role                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `layerOptions(opts)`                                               | core (exists)                       | passive identity                                                                                              |
| `createLayer(opts, client)`                                        | core (**add**)                      | explicit-client wired handle (layer ops + `stack`/`client`/`current` escapes); overload split plain/validated |
| `useLayer(opts, client?)`                                          | each adapter (**add**)              | context wired handle + reactive array `state`/`queued`/`top`; overload split plain/validated                  |
| `useLayerState({ key, stack?, select?, compare? }, client?)`       | each adapter (**rename + reshape**) | observe one key, mounted (was `useLayer(key, …)`); returns `LayerState[]`                                     |
| `useLayerQueuedState({ key, stack?, select?, compare? }, client?)` | each adapter (**add**)              | observe one key, queued; returns `LayerState[]`                                                               |
| `useStack({ stack?, select?, compare? }, client?)`                 | each adapter (**reshape**)          | whole-stack mounted snapshot (was positional; `selector`→`select`; explicit-client overload deleted)          |
| `useQueuedStack({ stack?, select?, compare? }, client?)`           | each adapter (**add**)              | whole-stack queued snapshot                                                                                   |
| `useLayerClient()`                                                 | adapter (exists)                    | full client (multi-stack / power)                                                                             |

## 4. Core design

### 4.1 `LayerHandle` + `ValidatedLayerHandle` (returned by `createLayer`; the adapter `useLayer` adds `state`/`queued`/`top`)

```ts
export interface LayerHandle<P, R, E, D, RP> {
  // identity-bound layer ops — payload only, NO per-call `rest` bag (see notes below):
  open: (payload: PayloadArg<P>["payload"]) => Promise<R>;
  upsert: (payload: PayloadArg<P>["payload"]) => Promise<R>;
  // call-specific control (earned (A) bags — target selection + force):
  dismiss: (
    response?: R,
    opts?: DismissOptions & { id?: string },
  ) => Promise<boolean>;
  update: (patch: Partial<P>, opts?: { id?: string }) => void;
  cancelQueued: (response?: R, opts?: { id?: string }) => boolean;
  // escapes (stack-level ops via .stack, not re-delegated):
  readonly client: LayerClient;
  readonly stack: LayerStack<P, R, E, D>;
  readonly options: LayerOptions<P, R, E, D, RP> & {
    key: DataTag<LayerKey, R, E>;
  };
  // best-effort bound instance, LIVE-CHECKED (null = not currently in stack):
  readonly current: Layer<P, R, E, D> | null;
}

// Validated variant: open/upsert take validator INPUT; state/update/current use OUTPUT.
export interface ValidatedLayerHandle<V, R, E, D, RP> extends Omit<
  LayerHandle<InferValidatorOutput<V>, R, E, D, RP>,
  "open" | "upsert"
> {
  open: (payload: OpenValidatePayload<V>) => Promise<R>;
  upsert: (payload: OpenValidatePayload<V>) => Promise<R>;
}
```

- **No `rest` bag on `open`/`upsert`** — per-call-override principle: per-call bags carry **(A) call-specific concerns** (e.g. `dismiss`/`update`/`cancelQueued` `{id, force}` = which instance + force THIS call); **(B) identity-bound defaults** (`enteringDelay`/`exitingDelay`/`loadFn`/`upsert`/`validate`) live in the entity-options bag (`layerOptions`), declared once, re-evaluated per `useLayer(options)` render — **never overridden via a trailing bag**. `open` has no (A) concerns (returns `Promise<R>`; the response IS the resolution — no per-call callback/scope/meta); its would-be `rest` members are all (B) identity-bound with 0 real per-call variation in the repo. So `open`/`upsert` earn **no bag**. Per-call overrides, if ever needed, route to `handle.client.open({...options, payload, override})` (the low-level bag escape) or `c.upsert(payload)` (the dedicated upsert entry). **Future demand-gated path:** a real per-call variation of an identity default (e.g. "this open animates, that one doesn't") would follow a **curated paired pattern** — a single named field with `perCall ?? identityDefault` — **not** a generic `Partial<LayerOptions>` override bag.
- **Payload optionality** (`PayloadArg<P>["payload"]`): payload required when `P` required, optional when `P` is `void`/`undefined`/`T | undefined` — mirrors `client.open`'s `PayloadArg` (types.ts L131–133). `c.open()` for no-payload layers; `c.open(payload)` for required-payload. No `undefined`-hole (the hole was no-payload+`rest`; without `rest`, `c.open()` works via `PayloadArg`).
- **Single-bag control (earned (A) bags)**: `dismiss(response?, { id?, force? })` / `update(patch, { id? })` / `cancelQueued(response?, { id? })` — no `id` = topmost (documented default); `{ id }` = exact (id from `c.state`/`c.queued`/`c.current?.id`). No positional-id holes, no R/string ambiguity (id named). `dismiss`-mine = `c.dismiss(resp, { id: c.current?.id })` (explicit, no hidden `mine` default). These bags are **earned** (target selection is a distinct, common control dimension in the (E-both) concurrent-same-key design; no ergonomic escape equivalent) — unlike `open`'s unearned (B) `rest`.
- **`current` is live-checked**: `get current() { return mine ? (stack.getLayer(mine.id) ?? null) : null }` — never stale; `null` = bound instance not currently in the stack (never opened / dismissed / gc'd / self-dismissed via `call.end`). Used for correlation + explicit-`id` control; NOT a hidden control default.
- **Stack-level ops via `.stack`** (not re-delegated): `dismissAll`/`addBlocker`/`getSnapshot`/`getQueuedSnapshot`/`subscribe` (and `setOptions` if/when `LayerStack` gains it) — `handle.stack.*`. Scope honesty: those are stack-scoped, not layer-scoped.
- **Validate variant**: when `options.validate: V` is bound, `createLayer` returns `ValidatedLayerHandle<V,…>` — `open`/`upsert` payload = `OpenValidatePayload<V>` (INPUT, required — mirrors `client.open` overload #1), `state`/`update`/`current` use `InferValidatorOutput<V>` (OUTPUT). Type-level only (impl unchanged — `stack.open` runs `validatePayload` against INPUT at runtime). Proven by `index.test-d.ts:105–138`.

### 4.2 `createLayer` impl

```ts
export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & {
    key: LayerKey;
    validate?: undefined;
  },
  client: LayerClient,
): LayerHandle<P, R, E, D, RP>;

export function createLayer<
  V extends Validator<unknown>,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<InferValidatorOutput<V>, R, E, D, RP> & {
    key: LayerKey;
    validate: V;
  },
  client: LayerClient,
): ValidatedLayerHandle<V, R, E, D, RP>;

export function createLayer<
  P,
  R,
  E = DefaultLayerError,
  D = unknown,
  RP = unknown,
>(
  options: LayerOptions<P, R, E, D, RP> & { key: LayerKey },
  client: LayerClient,
): LayerHandle<P, R, E, D, RP> {
  const stackId = options.stack ?? "default";
  const stack = client.getStack(stackId) as unknown as LayerStack<P, R, E, D>;
  const opts = options as LayerOptions<P, R, E, D, RP> & {
    key: DataTag<LayerKey, R, E>;
  };
  const sig = keySignature(opts.key);
  let mine: Layer<P, R, E, D> | undefined; // bound instance (for `current` only)

  const toOpenOpts = (payload: P): OpenOpts<P, D> => ({
    key: opts.key,
    payload,
    component: opts.component,
    enteringDelay: opts.enteringDelay,
    exitingDelay: opts.exitingDelay,
    upsert: opts.upsert,
    loadFn: opts.loadFn,
    validate: opts.validate, // identity-bound (no per-call override on the handle)
  });

  // resolve target: explicit id (must match key) → else topmost-by-key (findLast).
  const target = (id?: string): Layer<P, R, E, D> | undefined => {
    if (id) {
      const l = stack.getLayer(id);
      return l && keySignature(l.key) === sig ? l : undefined;
    }
    return stack.find(opts.key);
  };

  return {
    open: (payload) => {
      mine = stack.open(toOpenOpts(payload as P));
      return mine.promise.promise as Promise<R>;
    },
    upsert: (payload) => {
      mine = stack.open({ ...toOpenOpts(payload as P), upsert: true });
      return mine.promise.promise as Promise<R>;
    },
    dismiss: (response, o) => {
      const l = target(o?.id);
      return l
        ? stack.dismiss(l, response as R, { force: o?.force })
        : Promise.resolve(false);
    },
    update: (patch, o) => {
      const l = target(o?.id);
      if (l) stack.update(l, patch);
    },
    cancelQueued: (response) => stack.cancelQueued(opts.key, response as R), // key-based first-queued (by-id: orthogonal core add)
    client,
    stack,
    options: opts,
    get current(): Layer<P, R, E, D> | null {
      return (mine ? (stack.getLayer(mine.id) ?? null) : null) as Layer<
        P,
        R,
        E,
        D
      > | null;
    },
  };
}
```

`open`/`upsert` call `stack.open` (returns the `Layer`) to bind `mine` for `current`; return `mine.promise.promise` (await unchanged). Runtime is INPUT-correct (`stack.open` runs `validatePayload`); the signature variant types the consumer's arg.

**No new core types.** The handle reuses existing engine types: `PayloadArg<P>` (types.ts L131–133), `OpenValidatePayload<V>` + `InferValidatorOutput<V>` (validators.ts / layerClient.ts), `DataTag` (dataTag.ts). The earlier-proposed `PerOpen<…>` (a per-call `rest` bag) and `PayloadOf<O>` (the dropped positional `client.open` overload's inference) are **both dropped** — `rest` is removed (per-call-override principle: identity-bound defaults aren't overridden per-call; see §4.1), and the positional `client.open` overload was dropped (§1). `NoInfer` is the TS built-in (already used in `layerClient.ts`).

### 4.3 `LayerStack.find` → topmost

```ts
find(key: LayerKey): Layer<P, R, E, D> | undefined {
  const sig = keySignature(key);
  return this.#layers.findLast((l) => keySignature(l.key) === sig);  // was .find (bottommost)
}
// cancelQueued unchanged (first-queued FIFO, findIndex on #scopeQueue)
```

`#layers` appends on commit → last = topmost = newest = "active". Topmost is the intuitive "active layer" projection for `find`/`upsert`/`active()`/observe. `cancelQueued` stays first-queued (FIFO — different collection, different semantics). Blast radius: `upsert` (merges topmost same-key — more intuitive), adapter `AppLayer` dismiss (1:1 key in practice — unaffected), `find(["dup"])===second` test (post-removal — unaffected), other `find` tests (single-instance — unaffected). The only real behavior change is the rare concurrent-same-key edge, where topmost is the intuitive pick.

## 5. Adapter design — `useLayer` + `useLayerState` + `useQueuedStack` + `useLayerQueuedState` (all six)

All hooks are options-bag + optional trailing `client` (options-bag + optional trailing `client` override). (Separate): one named hook per source — `useStack`/`useQueuedStack` (whole-stack mounted/queued) + `useLayerState`/`useLayerQueuedState` (per-key mounted/queued) — mirroring core's `getSnapshot`/`getQueuedSnapshot` two-method split (focused primitives — two names > a flag; one hook per source).

- **`useStack`** = mounted whole-stack `LayerState[]` (or selected `T`).
- **`useQueuedStack`** = queued whole-stack `LayerState[]` (or selected `T`) — NEW.
- **`useLayerState({ key, … })`** = mounted same-key `LayerState[]` (or selected `U`) — renamed from `useLayer(key, …)`.
- **`useLayerQueuedState({ key, … })`** = queued same-key `LayerState[]` (or selected `U`) — NEW.
- **`useLayer(options, client?)`** = `createLayer(options, <client>)` + reactive `state` (mounted same-key) + `queued` (queued same-key, via the public `useQueuedStack`) + `top` (derived). Overload split plain/validated.

`state`/`queued` are **arrays** (all same-key) — honest about concurrent same-key (no singular topmost pick hiding instances). `top` is the common-case sugar. `getSnapshot`/`subscribe` on the handle are the raw stack escapes (core); `state`/`queued` are the reactive per-key projections (adapter). Distinct purposes, both kept.

| Adapter        | `useLayer(...).state` / `useLayerState(...)` / `useQueuedStack(...)` / `useLayerQueuedState(...)` | Entry names                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| React / Preact | `LayerState[]` (plain)                                                                            | `useLayer` / `useLayerState` / `useQueuedStack` / `useLayerQueuedState`             |
| Vue            | `Readonly<Ref<LayerState[]>>`                                                                     | same                                                                                |
| Solid          | `Accessor<LayerState[]>`                                                                          | same (+ `create*` aliases idiomatic)                                                |
| Svelte runes   | `LayerState[]` (via `SvelteStack.current`)                                                        | `createLayer` / `createLayerState` / `createQueuedStack` / `createLayerQueuedState` |
| Svelte store   | `Readable<LayerState[]>`                                                                          | same (store entry)                                                                  |
| Angular        | `Signal<LayerState[]>`                                                                            | `injectLayer` / `injectLayerState` / `injectQueuedStack` / `injectLayerQueuedState` |

Parity = engine capability, not identical DX (architecture.md). `useLayer` does not change rendering — Angular/Svelte render via their existing primitives.

React reference impls:

```ts
// Private shared snapshot primitive (backs all four public hooks; one cache/compare/useSyncExternalStore).
function useSnapshot<T>(stack, getSource, select, compare): T {
  /* useSyncExternalStore + selector cache */
}

export function useStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): T {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  return useSnapshot(
    stack,
    () => stack.getSnapshot(),
    opts.select ?? defaultSelector,
    opts.compare ?? Object.is,
  );
}
export function useQueuedStack<T = LayerState[]>(
  opts: UseStackOptions<T> = {},
  client?: LayerClient,
): T {
  const resolved = client ?? useLayerClient();
  const stack = resolved.getStack(opts.stack ?? "default");
  return useSnapshot(
    stack,
    () => stack.getQueuedSnapshot(),
    opts.select ?? defaultSelector,
    opts.compare ?? Object.is,
  );
}

export function useLayerState<Key, U = LayerState[]>(
  opts: UseLayerStateOptions<Key, U>,
  client?: LayerClient,
): U {
  const sig = useMemo(() => keySignature(opts.key), [opts.key]);
  return useStack<U>(
    {
      stack: opts.stack ?? "default",
      select: (s) =>
        (opts.select ?? identity)(s.filter((x) => keySignature(x.key) === sig)),
      compare: opts.compare,
    },
    client,
  );
}
export function useLayerQueuedState<Key, U = LayerState[]>(
  opts: UseLayerStateOptions<Key, U>,
  client?: LayerClient,
): U {
  const sig = useMemo(() => keySignature(opts.key), [opts.key]);
  return useQueuedStack<U>(
    {
      stack: opts.stack ?? "default",
      select: (s) =>
        (opts.select ?? identity)(s.filter((x) => keySignature(x.key) === sig)),
      compare: opts.compare,
    },
    client,
  );
}

export function useLayer<P, R, E, D, RP>(options, client?) {
  const resolved = client ?? useLayerClient();
  const stackId = options.stack ?? "default";
  const sig = useMemo(() => keySignature(options.key), [options.key]);
  const selectByKey = (states: LayerState[]) =>
    states.filter((s) => keySignature(s.key) === sig) as LayerState<
      P,
      R,
      E,
      D
    >[];
  const state = useStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey },
    resolved,
  );
  const queued = useQueuedStack<LayerState<P, R, E, D>[]>(
    { stack: stackId, select: selectByKey },
    resolved,
  ); // public useQueuedStack
  const top = state.at(-1) ?? null;
  const handle = useMemo(
    () => createLayer(options, resolved),
    [resolved, options.key, options.stack],
  );
  return { ...handle, state, queued, top };
}
```

## 6. SSR safety

- `useLayer` reads the **request-scoped** client from context (or the trailing `client?`); `state`/`queued` server-snapshot to `[]` (`useSnapshot` `getServerSnapshot` → `select([])`); `open` runs in effects/handlers, never during SSR render. Safe.
- `useLayerState`/`useQueuedStack`/`useLayerQueuedState` server-snapshot to `[]`.
- `createLayer(options, client)` takes a **request-scoped** client (server) or app client (client). No overload bakes a module-global `new LayerClient()` → the request-bleeding footgun is not encouraged.
- `layerOptions` (module-scope, pure config) remains SSR-safe (captures nothing).

## 7. Per-adapter implementation tasks

**Core (`packages/core`):**

- Add `LayerHandle` + `ValidatedLayerHandle` types + `createLayer(options, client)` (overload split plain/validated) in `packages/core/src/createLayer.ts`; export from `packages/core/src/index.ts`.
- **No new core types** — the handle reuses existing `PayloadArg`/`OpenValidatePayload`/`InferValidatorOutput`/`DataTag` (see §4.2). (The earlier-proposed `PerOpen` + `PayloadOf` are dropped — `rest` removed, positional `client.open` overload removed.)
- **Topmost-by-key `find`**: flip `LayerStack.find` → `findLast`; keep `cancelQueued` first-queued. Verify `upsert` tests still pass.
- Type pass: `*.test-d.ts` for inference — `createLayer(confirm).open(payload)` infers `R`; `createLayer(validatedConfirm).open(input)` infers INPUT vs OUTPUT; `PayloadArg` optionality (no-payload `open()`; required-payload enforced); `current` typed.

**Each adapter (`packages/{react,preact,vue,solid,svelte,angular}/src`):**

- Add `useLayer(options, client?)` (overload split plain/validated) → `createLayer(options, <client>)` + reactive `state`/`queued`/`top`.
- Rename `useLayer(key, stackId?, compare?)` → `useLayerState({ key, stack?, select?, compare? }, client?)`; options bag; delete the explicit-client overload (Vue/Solid/Svelte/Angular).
- Add `useQueuedStack({ stack?, select?, compare? }, client?)` + `useLayerQueuedState({ key, stack?, select?, compare? }, client?)` (new exports).
- Reshape `useStack` to `useStack({ stack?, select?, compare? }, client?)`; rename `selector` → `select`; delete the explicit-client overload.
- Re-export `createLayer` from the adapter.
- Per-adapter entry names per §5 table (Solid/Svelte `create*` aliases; Angular `inject*`).
- **React: replace `keySignatureCached` with core `keySignature`** (sorted-object replacer; aligns React with the other 5 adapters + core `find`/`upsert`/`current`; fixes the pre-existing object-key mismatch).
- Per-adapter DOM test (`tests-dom/`): `useLayer` open/dismiss/update/cancelQueued/`state`/`queued`/`top`/`current` + `stack` escape; handle `open` no-spread + `PayloadArg` optionality; `client` escape; `useLayerState`/`useLayerQueuedState` observe arrays + `select`; `useStack`/`useQueuedStack` options-bag + `select` + trailing `client`; two-`useLayer`-same-key no-mingling (explicit `{ id: c.current?.id }`); validated handle (input-typed `open`, output-typed `state`).
- Per-adapter type test (`*.test-d.*`): `useLayer(confirm).open(payload)` infers `R`; `useLayer(validatedConfirm).open(input)` infers INPUT; `state` typed OUTPUT; `useLayerState({ key })` infers `R`/`E`; `select` slicing; `PayloadArg` (no-payload `open()`; required-payload enforced).

**Docs sweep (respecting `.agents/`):**

Apply `docs-governance` (lifecycle + cross-reference preservation + existence test) and `verify-after-each-step` (format/lint on each touched `.md`); follow `authoring-discipline` (prose density, preserve existing comments, no brittle anchors).

- `README.md` — "Taste" example → `useLayer` form (keep `layerOptions` + `client.open` bag form as the low-level alternative); When-to-use / Concepts; note `useLayerState`/`useQueuedStack`/`useLayerQueuedState` for observe; note validated `open` (INPUT vs OUTPUT).
- `docs/architecture.md` — add `createLayer`/`useLayer`/`useLayerState`/`useQueuedStack`/`useLayerQueuedState`/`LayerHandle`/`ValidatedLayerHandle` to the public surface (Core/Adapters bullets in `## Package boundary`); note `LayerHandle` = layer ops + `stack`/`client`/`current` escapes (stack-level via `.stack`); disambiguate `useLayer` (drive) vs `useLayerState` (observe) vs `useQueuedStack`/`useLayerQueuedState` (queued observe); note topmost `find` + array observe honesty.
- `docs/glossary.md` — add `createLayer`, `useLayer`, `useLayerState`, `useQueuedStack`, `useLayerQueuedState`, `LayerHandle`, `ValidatedLayerHandle`, `current` terms.
- `docs/README.md` — docs index: link this plan.
- `docs/roadmap.md` — optional reference.
- `packages/core/README.md` — `createLayer` + `LayerHandle`/`ValidatedLayerHandle` (core exports).
- `packages/{react,preact,vue,solid,svelte,angular}/README.md` (×6) — `useLayer` + `useLayerState` + `useQueuedStack` + `useLayerQueuedState` + `useStack` options-bag form + re-export of `createLayer`.
- `packages/{core,react,preact,vue,solid,svelte,angular}/skills/*/SKILL.md` (×7) — add the new hooks to the API surface they document; reflect `useStack` options-bag + `select` rename + `useQueuedStack`/`useLayerQueuedState`; preserve existing skill structure.

Migration note (breaking, major): `useLayer(confirm.key, "confirm")` → `useLayerState({ key: confirm.key, stack: "confirm" })`; `useStack("confirm", sel)` → `useStack({ stack: "confirm", select: sel })`; `client.open({...confirm, payload})` → `createLayer(confirm, client).open(payload)` or `useLayer(confirm).open(payload)` (the handle is the no-spread path; `client.open` bag form stays for low-level callers). Observe hooks now return arrays (`LayerState | null` → `LayerState[]`).

## 8. Tracer-bullet slice (first PR)

1. Core: `createLayer` (plain + validated overloads) + `LayerHandle`/`ValidatedLayerHandle` + `find`→`findLast` + `*.test-d.ts` inference (incl validated INPUT/OUTPUT + `PayloadArg` optionality). No new core types (reuses `PayloadArg`/`OpenValidatePayload`/`InferValidatorOutput`/`DataTag`).
2. React adapter: `useLayer` (plain + validated) + `useLayerState` (rename) + `useQueuedStack` + `useLayerQueuedState` + `useStack` reshape + React `keySignature` fix + `tests-dom` + `*.test-d.tsx`.
3. One end-to-end example in README (confirm dialog: declare → host → `useLayer` → `open` → `dismiss`; observe via `useLayerState`; validated variant showing input-typed `open`).
   Validate (per `verify-after-each-step`): `bun run typecheck`, `bun test packages/core`, `bun run test:dom` for react, lint-staged on touched files. Then fan out to the other 5 adapters.

## 9. Grill outcomes

### Resolved during grill

- **Naming collision (`useLayer`)** → **parallel-hooks split**: `useLayer(options)` (drive + observe, handle + array `state`/`queued`/`top`) **+** `useLayerState({ key, … })` (observe-only, the renamed key hook). Both kept; no overload-on-first-arg-shape; no same-name supersession.
- **Observe shape (B vs E-split vs E-both)** → **(E-both) array observe**: `useLayer.state`/`useLayerState` return `LayerState[]` (all same-key) — honest about concurrent same-key (no singular topmost pick hiding instances). `top` sugar for the common case. (D) instance-bound + (B) singular rejected (D: `mine` fragile + hidden control flow + queued bug; B: hides multi-instance).
- **Instance-owning control (mutation-observer-style `mine`-default)** → **impossible + wrong for a key-born/key-dedup engine**: layers can't bind the instance the way an instance-owning observer does (4 blockers — `client.open` returns `Promise` not `Layer`; key-based caller-side; key-shared observe; notify-before-return race). All control options share key-pick-topmost + `stack` escape. Binding survives only as the **live-checked `current` escape** (correlation + explicit-`{id}` control), NOT a hidden `mine`-default.
- **Control surface** → **single-bag + named `{id}`**: `dismiss(response?, { id?, force? })` / `update(patch, { id? })` / `cancelQueued(response?, { id? })`; no-id = topmost (documented); `{id}` = exact. No positional-id holes, no R/string ambiguity. Rejected: two-variant `*ById` (bare=mine hits the queued `#scopeQueue.shift()` bug + needs hidden routing with divergent return types; bare=topmost collapses into single-bag-split).
- **`LayerClient.open` positional overload** → **dropped**: redundant with the handle's no-spread `open`; optional positional object args = the argument-order DX smell; a second calling convention on top of the single-bag `client.open`. `client.open` stays single-bag.
- **`useStack` queued shape** → **(Separate) two named hooks**: `useStack` (mounted) + `useQueuedStack` (queued) + `useLayerState` (per-key mounted) + `useLayerQueuedState` (per-key queued) — mirror core's `getSnapshot`/`getQueuedSnapshot` two-method split (focused primitives — two names > a flag). Rejected: `{state,queued}` return (second break + perf tax + unsolvable `select`/`compare` + wrapper churn); `queued?: boolean` toggle (less explicit than two named hooks).
- **Validate typing gap** → **`ValidatedLayerHandle` overload split**: `createLayer`/`useLayer` overloads keyed off `options.validate` → `ValidatedLayerHandle<V,…>` (`open`/`upsert` payload = `OpenValidatePayload<V>` INPUT; `state`/`update`/`current` = `InferValidatorOutput<V>` OUTPUT). Type-level only (impl unchanged — `stack.open` runs `validatePayload`). Mirrors `client.open` overload #1. `validate` is identity-bound (declared in `layerOptions`), not a per-call override; the handle's `open` has no `rest` bag (see §4.1).
- **Handle surface scope** → layer-level ops at top level; stack-level ops via `handle.stack.*` (not re-delegated; scope honesty; avoids `LayerStack.setOptions` gating the handle).
- **Topmost-by-key `find`** → flip `LayerStack.find` → `findLast`; `cancelQueued` stays first-queued (FIFO).
- **React `keySignatureCached`** → core `keySignature` (fixes pre-existing object-key mismatch; aligns React with the other 5 adapters + core).
- **`useMemo` deps** → key on `options.key` + `options.stack` (stable primitives), not the options object ref.
- **`dismiss`/`update` with no active layer** → no-op + `Promise.resolve(false)` (idempotent); document.
- **`cancelQueued(response?)`** → core stays strict (`response: R`); handle passes `response ?? (undefined as R)`.
- **`createLayer` vs `layerOptions`** → `createLayer` requires a client; no-client identity is `layerOptions`.
- **`open`/`upsert` payload optionality** → mirror `PayloadArg<P>` (required-when-P-required, optional-when-P-optional); **no `rest` bag** (per-call-override principle: identity-bound defaults aren't overridden per-call — see §4.1; 0 real per-call variation in the repo; per-call overrides → `handle.client.open` bag escape or `c.upsert()`). Future per-call override, if earned, follows the curated paired pattern (`perCall ?? identityDefault`), not a generic `Partial` bag.
- **No `rest` bag on `open`/`upsert` (per-call-override principle)** → per-call bags carry **(A) call-specific concerns** only (`dismiss`/`update`/`cancelQueued` `{id, force}` = which instance + force THIS call — earned); **(B) identity-bound defaults** (`enteringDelay`/`exitingDelay`/`loadFn`/`upsert`/`validate`) live in `layerOptions`, never overridden per-call. `open` has no (A) concerns (response IS resolution); its would-be `rest` is all (B) with 0 usage → no bag. The open/dismiss asymmetry (no bag vs earned (A) bag) is the principle's prediction. `PerOpen` + `PayloadOf` dropped (dead — no new core types).

### Open (resolve during the slice)

- **Validate variant tracer-bullet gate** — implement the `ValidatedLayerHandle` overload split in slice 1; if TS inference proves hostile across adapters, fall back to **Restrict** (drop `validate` from the handle's `open` path; route validate users to `client.open` bag form — the typed escape). No silent Accept.
- **`findLast` mechanism** — flip `find`→`findLast` (consistency: upsert/observe/active all topmost; changes `upsert`'s rare-edge reuse target — arguably more correct) **vs** dedicated `findLast(key)` method leaving `find`/`upsert` bottommost (safer for shipped `upsert`, but `upsert`-bottommost vs `state`/`active`-topmost inconsistent in the rare concurrent-then-upsert case). Lean: **flip** (consistency > rare-edge; experimental-major accepted).
- **`cancelQueued` by-id** — core `cancelQueued(key, response)` is key-based first-queued; the handle's `{ id }` is accepted but not yet instance-exact (orthogonal core `cancelQueuedById` or `#scopeQueue` id-scan). Documented limit.

### Backlog (orthogonal, not blocking this plan)

- **`LayerStack.setOptions`** — add as a separate enhancement so `handle.stack.setOptions(...)` can change `scope`/`gcTime`/`dismissAllMode` post-construction; today `LayerStack.options` is `readonly` and stack options are construct-time-only.

## 10. Architecture-priming flag

This adds a new core public export (`createLayer` + `ValidatedLayerHandle` type) + new exports in all 6 adapters (`useLayer`, `useLayerState`, `useQueuedStack`, `useLayerQueuedState`) + reshapes `useStack` (signature) + flips `LayerStack.find` + fixes React `keySignature`. Signals: "new shared utility under `packages/*/src/` with 3+ projected consumers" (core `createLayer` consumed by 6 adapters) — **run `improve-codebase-architecture` before the implementation PR**, and `harden-pr` full before merge. No new `package.json` `exports` subpath entry (exported from existing main entry; Svelte `./store` unchanged), no new barrel, no core/adapter boundary breach (`createLayer` imports only core types; adapters import `createLayer` from core + their framework peer — same isolation invariant as today, enforced by `sherif`/`knip`). No new `LayerClient.open` overload (the handle is the no-spread path; `client.open` keeps its single bag signature).

## 11. Out of scope (guardrails)

- No `.use()`/`.bind()` methods on passive objects.
- No narrowed `{open,dismiss,upsert,update}`-only handle.
- No module-global default client / no `createLayer(opts)` without a client (avoids the rename trap + singleton).
- No singular `state`/`states` on the handle — observe is **array** (`LayerState[]`) for honesty; `top` is sugar.
- No hidden `mine`-default control — `current` is live-checked correlation + explicit-`{id}` opt-in; control default is topmost (documented).
- No overload-on-first-arg-shape for `useLayer` (tuple vs object); the observe role is `useLayerState`.
- No positional `LayerClient.open(opts, payload?, rest?)` overload — the handle is the no-spread path.
- No `{state, queued}` return on `useStack`; no `queued?: boolean` toggle — queued-observe is the separate `useQueuedStack`/`useLayerQueuedState` hooks.
- No `*ById` control method pairs — single-bag + named `{id}`.
- No per-call `rest` bag on `open`/`upsert` (identity-bound defaults — `enteringDelay`/`exitingDelay`/`loadFn`/`upsert`/`validate` — are declared in `layerOptions`, not overridden per-call; per-call-override principle, §4.1). Per-call overrides route to `handle.client.open({...options, payload, override})` (escape) or `c.upsert()` (dedicated). Future per-call override, if earned, is a curated paired field (`perCall ?? identityDefault`), not a generic `Partial` bag.
- No change to `layerOptions`, `useLayerClient`, `StackProvider`/`StackOutlet`, the `call` handle, or stack-level option _semantics_ (`scope`/`gcTime`/`dismissAllMode`). `LayerStack.setOptions` is an orthogonal enhancement (Backlog), not part of this plan's handle surface. `useStack` _signature_ is reshaped (options bag) but its subscription semantics are unchanged.
- Further actionable items still pending grill; this plan covers this item only.
