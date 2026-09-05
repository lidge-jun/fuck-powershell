---
id: workaround-handle-owner-snapshot-before-delete
type: Workaround
label: "handle owner snapshot before delete"
---

## Definition

When a directory refuses deletion, capture who holds it (handle.exe, openfiles /query, Resource Monitor) BEFORE removing it; once it is gone the question cannot be answered, and "the dead process still holds it" is not a valid answer because Windows closes handles at exit.

