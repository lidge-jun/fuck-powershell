---
id: mechanism-tcb-retention
type: Mechanism
label: "TCP control block outlives the socket"
---

## Definition

Windows retains the transmission control block for a closed socket so the endpoint stays unbindable, and its SO_REUSEADDR waives that state by also permitting an active listener to be hijacked, so runtimes refuse to set it and the POSIX escape hatch is unavailable rather than merely ineffective.
