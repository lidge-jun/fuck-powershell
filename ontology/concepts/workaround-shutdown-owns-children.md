---
id: workaround-shutdown-owns-children
type: Workaround
label: "shutdown owns children"
---

## Definition

Track every background child the process starts, keyed by the resource it touches, and await it inside the same shutdown routine that closes listeners and releases lifecycle hooks, so nothing holds a handle after stop() resolves.
