---
id: workaround-consume-arg-downstream
type: Workaround
label: "consume arg downstream"
---

## Definition

Forward %* untouched and let the dispatched program read its own leading argument. Nothing shifts, so %* stays correct and the eight-argument ceiling of positional forwarding never appears.

