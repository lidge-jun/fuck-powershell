---
id: workaround-exitcode-not-exit
type: Workaround
label: "set exitCode and unwind instead of calling exit"
---

## Definition

Assign the process exit code and return so the event loop drains naturally, and remove lingering keep-alive sockets and timer handles rather than terminating the runtime while they are still closing.
