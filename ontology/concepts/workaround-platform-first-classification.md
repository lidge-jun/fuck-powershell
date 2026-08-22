---
id: workaround-platform-first-classification
type: Workaround
label: "classify by process.platform first, env markers second"
---

## Definition

Decide the platform from the runtime's own platform value before consulting any environment marker, so a win32 process can never be classified as WSL and interop variables shared across the boundary cannot flip the branch.
