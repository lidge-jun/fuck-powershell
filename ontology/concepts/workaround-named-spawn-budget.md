---
id: workaround-named-spawn-budget
type: Workaround
label: "named spawn budget"
---

## Definition

Use the repository's named constant for tests that boot real child processes (e.g. SPAWN_BUDGET_MS) instead of a literal sized from a local run, after proving the wait is intrinsic via an ablation that turns the case red.

