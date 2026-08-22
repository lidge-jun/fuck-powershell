---
id: mechanism-tcb-retention
type: Mechanism
label: "TCP control block outlives the socket"
---

## Definition

Windows retains the transmission control block for a closed socket so the endpoint stays unbindable, and SO_REUSEADDR carries different semantics there than on POSIX, so the option that waives TIME_WAIT on Linux does not waive it here.
