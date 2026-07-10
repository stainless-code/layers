---
description: Tracer-bullet slices — build a tiny end-to-end slice first, validate, then expand; never build horizontal layers in isolation.
alwaysApply: true
---

# Tracer bullets

Build a tiny end-to-end slice first, validate, then expand. AI agents tend to produce complete solutions in one leap without testing the critical path.

## Rules

1. **One vertical slice** — entry + module + co-located test for the simplest case (e.g. one `LayerStack.cancelQueued` behavior + its test).
2. **Commit and validate** before expanding — pre-commit runs format, lint, typecheck, tests on staged files.
3. **Lite-harden the slice** — [`harden-pr`](../skills/harden-pr/SKILL.md) **lite** mode after each slice (fix in working tree; commit when the user asks).
4. **Expand outward** from the working slice.
5. **Never build horizontal layers in isolation** (all adapters before any core wiring, etc.).

Before opening a PR: [`harden-pr`](../skills/harden-pr/SKILL.md) **full** on `origin/main...HEAD`.
