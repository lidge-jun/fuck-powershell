---
id: error-eaddrinuse
type: ErrorSignature
label: "EADDRINUSE with no owning process"
---

## Definition

A bind is refused because the endpoint is occupied, and on Windows the occupant may be a leftover transmission control block rather than a process, so the port appears busy while every process listing is empty.
