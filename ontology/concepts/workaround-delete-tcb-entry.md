---
id: workaround-delete-tcb-entry
type: Workaround
label: "delete the leftover TCB or stop needing a fixed port"
---

## Definition

Tear down a specific leftover connection with SetTcpEntry in the delete-TCB state, accepting that it needs elevation and covers IPv4 only, or avoid the dependency entirely by binding an ephemeral port and publishing the assigned value.
