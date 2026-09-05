---
id: workaround-reap-before-delete
type: Workaround
label: "reap before delete"
---

## Definition

Register every spawned child on the fixture; on teardown release holders, kill survivors, and await every exit BEFORE removing the fixture root, so no child holds a handle inside the directory being deleted.

