# Language

Shared vocabulary for every suggestion this skill makes. Use these terms exactly — don't substitute "component," "service," "API," or "boundary." Consistent language is the whole point of this file: a glossary stops the next round of "did 'stack' mean the LayerStack, the ordered array, or the call stack?" drift.

> Vocabulary extends the seam model in [`docs/architecture.md`](../../../docs/architecture.md) and the layer/stack nouns in [`docs/glossary.md`](../../../docs/glossary.md). Those cover domain terms; this file covers architecture nouns.

## Terms

**Module**
Anything with an interface and an implementation. Deliberately scale-agnostic — applies equally to a function, a class, a file with a public surface, or a subpath entry.
_Avoid_: unit, component, service. ("Component" conflicts with framework components; use "Module" even when the module is `packages/react/src/index.tsx`.)
_Examples in this repo_: a single factory (`layerOptions`); the Svelte store entry (`packages/svelte/src/store.ts`); the core entry (`packages/core/src/layerStack.ts` + `packages/core/src/layer.ts` + `packages/core/src/layerClient.ts` behind `packages/core/src/index.ts`); a framework binding (`packages/vue/src/index.ts`).

**Interface**
Everything a caller must know to use the module correctly. Includes the type signature, but also: invariants, ordering constraints, error modes, required configuration, the `LayerStack` `subscribe`/`getSnapshot` contract, the `LayerPhase` lifecycle.
_Avoid_: API (overloaded with the package public API), signature (too narrow — only the type-level surface).
_Examples in this repo_: `LayerClient.open(options)`'s interface includes the invariant that the response type is inferred from `layerOptions<P, R, E, D>` (phantom generics carried end-to-end); `LayerStack`'s interface includes `getSnapshot` returning a cached, referentially-stable array so `useSyncExternalStore` doesn't loop.

**Implementation**
What's inside a module — its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a framework binding wrapping `useSyncExternalStore` + selector + outlet rendering) or a large adapter with a small implementation (a binding that delegates almost entirely to the core).
_Reach for_ "adapter" when the seam is the topic; "implementation" otherwise.

**Depth**
Leverage at the interface — the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.
_Examples in this repo_: `LayerClient.open(options)` is deep — one call hides stack lookup, layer creation, the phase machine, `loadFn` + `AbortController`, scope queueing, the gcTime cache, and promise resolution. A thin wrapper that just re-exports `LayerClient` with no added behaviour would be shallow.

**Seam** _(from Michael Feathers' "Working Effectively with Legacy Code")_
A place where you can alter behaviour without editing in that place. The _location_ at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it.
_Avoid_: "boundary" — overloaded with DDD's bounded context AND with oxlint folder bans. Say **seam** when you mean "the testable place" and **lint boundary** when you mean "the enforced folder rule".
_Examples in this repo_: the package seam in `docs/architecture.md` — **core vs framework adapter** (`packages/core` owns the engine; each `packages/<fw>` package binds `LayerStack.subscribe`/`getSnapshot` to one framework's reactivity). The `LayerStack` `subscribe`/`getSnapshot` contract is the interface at which every adapter observes the stack without coupling to its internals.

**Adapter**
A concrete thing that satisfies an interface at a seam. Describes _role_ (what slot it fills), not substance (what's inside).
_Examples in this repo_: each framework binding (`react`, `preact`, `solid`, `angular`, `vue`, `lit`, `svelte`) is an adapter at the core/adapter seam. Seven adapters across the seam = a real seam (the engine is genuinely framework-agnostic); a single adapter would be hypothetical.

**Leverage**
What callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.
_Example_: `LayerClient.open(options)` carries the whole layer lifecycle; every framework adapter and consumer opens a layer in one call. Adding a new framework adapter is one binding, not N call-site edits.

**Locality**
What maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.
_Example_: the `notifyManager.batch` wrapping lives in one place in `packages/core/src/`; every adapter subscription benefits from it. Changing the batching rule is one edit, not per-adapter.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface. Example: `packages/core` exposes `LayerClient` / `LayerStack` / `layerOptions` plus low-level `Subscribable` / `notifyManager` / `ControlledPromise`; internally it composes the phase machine, scope queue, and gcTime cache without exposing those mechanisms.

- **The deletion test.** Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything (it was a pass-through). If complexity reappears across N callers, the module was earning its keep. Use this test on every shallow-module-suspect — the "yes, concentrates" answer is the signal you want to deepen.
  - **Example: a passing deletion test** — deleting `LayerClient` would resurrect per-app stack lookup, option merging, and promise wiring across every consumer. Deep, earning its keep.
  - **Example: a failing deletion test** — a wrapper that just re-exported `layerOptions` under another name. Deleting it removes the indirection without resurrecting any complexity. Shallow; deletion correct.

- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test _past_ the interface, the module is probably the wrong shape. Example: the zero-dep core invariant (`packages/core` has no dependencies and imports no framework peer) belongs at the package seam, enforced by package manifests plus dependency/import tooling rather than tests that mock internals.

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it. Example: a core/adapter seam with only a React adapter is hypothetical; add Svelte, Vue, Solid, Preact, and Angular and it's a real seam (each framework's reactivity is genuinely different). The seam is justified because the engine is the same across all six — don't introduce a per-adapter core fork before a second adapter genuinely needs it.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (one common mis-reading of Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow — interface here includes every fact a caller must know (invariants, ordering, error modes, the snapshot contract).
- **"Boundary"**: overloaded with DDD's bounded context AND with the lint-rule meaning we use for oxlint folder bans. Say **seam** when you mean "the testable place" and **lint boundary** when you mean "the enforced folder rule".

## Reference

- [`improve-codebase-architecture`](./SKILL.md)
- Project glossary (layer/stack domain terms, distinct from this architecture vocabulary): [`docs/glossary.md`](../../../docs/glossary.md). **They're complementary** — the project glossary covers domain nouns (`layer`, `stack`, `phase`, `call context`, `scope`, `gcTime`, `outlet`); this file covers architecture nouns (`module`, `seam`, `adapter`).
- Origin: John Ousterhout, "A Philosophy of Software Design" (deep modules); Michael Feathers, "Working Effectively with Legacy Code" (seams).
