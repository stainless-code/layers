---
description: After each working milestone, verify changed files using the same checks lint-staged runs
alwaysApply: true
---

# Verify after each step

After completing a step, verify every file you touched — don't wait for `git commit`.

## What counts as a step

Tracer-bullet slice, plan TODO, refactor, module/entry/hook change, bug fix, review comment.

## STOP

Verify every touched file before the next milestone — checks matching touched file patterns (lint/format on specific files, `bun run typecheck` when types may be affected, `bun test <paired test>` for `packages/*/src/` changes, `bun run test:dom` for `packages/*/tests-dom/**` when the package has a DOM harness). Fix before moving on; never carry forward known failures.

**Full per-file check table** (lint-staged, build config, DOM suite): [`verify-after-each-step`](../skills/verify-after-each-step/SKILL.md).

Related: [`no-bypass-hooks`](./no-bypass-hooks.md) · [`tracer-bullets`](./tracer-bullets.md) · [`harden-pr`](../skills/harden-pr/SKILL.md).
