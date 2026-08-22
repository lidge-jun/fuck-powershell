---
id: mechanism-no-process-group
type: Mechanism
label: "no POSIX process group"
---

## Definition

Windows offers termination of one process or of a live parent-PID tree, with no group you opted into, so killing a child orphans its descendants while a tree kill sweeps up any caller that happens to descend from the target.
