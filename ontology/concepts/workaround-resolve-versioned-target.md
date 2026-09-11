---
id: workaround-resolve-versioned-target
type: Workaround
label: "resolve the versioned payload instead of trusting a vendor junction"
---

## Definition

Probe the vendor-created 'current' link first, and when traversal through it yields nothing, resolve the versioned payload directory directly and pick the newest. Treats a link on PATH as a hint rather than a source of truth, which also survives an interrupted upgrade.

