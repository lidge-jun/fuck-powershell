---
id: workaround-bounded-rename-retry
type: Workaround
label: "bounded retry on transient replace failures"
---

## Definition

Retry a Windows rename a small fixed number of times on EPERM, EBUSY, and EACCES, since those signal a transient scanner or sync-client hold rather than a permission problem; keep the bound tight so a real error still surfaces.
