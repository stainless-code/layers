---
name: harden-pr
description: >-
  Bring a branch to pristine, maximum production readiness without changing PR intent —
  spawn parallel Task subagents (never inline review), fix in-bounds findings, loop autonomously until
  clean or pass cap, then report once. Use after a tracer-bullet commit (lite), before PR
  is done (full), on "harden", "harden-pr", "pristine", "review until clean",
  or "production-ready pass". Invoking this skill authorizes one harden commit at cycle end.
---

# Harden PR

Leave the branch **pristine** — every changed path shippable, verified, documented, hygienic. Polish what the PR already does; never change its intent or runtime behavior.

**Workflow** (run-to-completion, modes, roster, verification, git): [WORKFLOW.md](./WORKFLOW.md). **Ledger:** [LEDGER.md](./LEDGER.md).
