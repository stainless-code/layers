---
name: verify-after-each-step
description: Per-file verification checklist — lint-staged and package.json scripts after each milestone.
disable-model-invocation: true
---

# Verify after each step (full checklist)

Always-on priming: [`.agents/rules/verify-after-each-step.md`](../../rules/verify-after-each-step.md).

Run matching checks on every file touched **before** moving to the next milestone. Pre-commit is the safety net, not the first line of defense.

## Discover project scripts

1. **Read `package.json` `scripts`** at the start of a task.
2. **Read `lint-staged.config.js`** — which checks apply to which patterns (format/lint for code, format for prose/config, plus each affected package's `typecheck`, unit tests, and DOM tests when that package has `vitest.config.ts`).
3. Never assume script names — verify they exist in `package.json` before running.

## Per-file checks (this repo)

- `packages/<pkg>/src/**/*.ts(x)` (non-test): `bun run lint <file>` · `bun run format:check <file>` · `bun run --filter ./packages/<pkg> typecheck` · `bun test <paired test>`.
- `packages/<pkg>/src/**/*.test.ts(x)`: `bun test <file>` · `bun run lint <file>` · `bun run format:check <file>`.
- `packages/<pkg>/tests-dom/**`: when the package has `vitest.config.ts`, run `bun run --filter ./packages/<pkg> test:dom` · `bun run lint <file>` · `bun run format:check <file>`.
- `packages/<pkg>/vitest.config.ts`: `bun run format:check <file>` · `bun run --filter ./packages/<pkg> test:dom`.
- `packages/<pkg>/tsdown.config.ts` / `tsconfig*.json`: `bun run format:check <file>` · `bun run --filter ./packages/<pkg> build` · `bun run --filter ./packages/<pkg> typecheck`.
- Root build/type config: `bun run format:check <file>` · `bun run build` · `bun run typecheck`.
- `package.json` / `packages/*/package.json`: `bun run format:check <file>` · `bun install` (if deps changed) · `bun run check`.
- `docs/**` / `*.md` / `.agents/**`: `bun run format:check <file>`.
- `.github/**` / `*.yml`: `bun run format:check <file>`.

**Co-located pair:** `packages/<pkg>/src/foo.ts` → `packages/<pkg>/src/foo.test.ts` (during development, run the pair directly; lint-staged runs the affected package's full unit suite).

**Build config / entry points:** if a package's `tsdown.config.ts`, `package.json` `exports`, or `src/index.*` entry changed, add that package's build. For publish-surface changes, also run `bun run check:pack`.

Full gate before commit/push: `bun run typecheck && bun run test && bun run test:dom && bun run lint && bun run format:check` (and `bun run build` if entry points / build config changed). `.agents/` / `docs/` / `.github/` only need `bun run format:check`.

## Reference

Tier-1 priming: [`.agents/rules/verify-after-each-step.md`](../../rules/verify-after-each-step.md) · [`tracer-bullets`](../../rules/tracer-bullets.md) · [`no-bypass-hooks`](../../rules/no-bypass-hooks.md) · [`harden-pr`](../harden-pr/SKILL.md)
