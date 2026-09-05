---
id: workaround-raise-one-failing-case
type: Workaround
label: "raise one failing case"
---

## Definition

Raise the per-test timeout on the single case that failed.

## Why it's unsafe

On a runner with 2x variance the sibling cases sized the same way are the next to fail, and each discovery costs a full CI cycle.

