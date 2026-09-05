---
id: mechanism-unowned-child-lifetime
type: Mechanism
label: "unowned child lifetime"
---

## Definition

A spawned child whose promise or handle is dropped keeps running after its parent decides it is finished; Windows has no process group to tie the two, so the child's open handles outlive every shutdown step the parent awaited.
