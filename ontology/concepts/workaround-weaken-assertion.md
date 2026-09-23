---
id: workaround-weaken-assertion
type: Workaround
label: "weaken assertion"
---

## Definition

Widen or weaken a per-test path-containment assertion to accept a shared sandbox, suffix, basename, or other broader string match.

## Why it's unsafe

A path in a shared sandbox or outside the test's own temp home can then pass. The broader assertion hides a real per-test isolation failure instead of making the code resolve inside the test's configured home.
