---
id: workaround-weaken-assertion
type: Workaround
label: "weaken assertion"
---

## Definition

Replace a path containment assertion with a suffix, basename, or other weaker string check to make differing Windows path spellings pass.

## Why it's unsafe

A path outside the sandbox can share the same suffix or basename. Weakening the assertion hides a real escape instead of resolving the effective home and comparing canonical path components.
