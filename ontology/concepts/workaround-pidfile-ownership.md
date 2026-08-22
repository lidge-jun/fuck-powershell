---
id: workaround-pidfile-ownership
type: Workaround
label: "verify pidfile ownership instead of registration"
---

## Definition

Derive running state from a pidfile the process writes and an ownership check that the pid is alive and identifiably ours, keeping it distinct from whether an autostart artifact is registered.
