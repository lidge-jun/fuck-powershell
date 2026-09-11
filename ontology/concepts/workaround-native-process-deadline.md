---
id: workaround-native-process-deadline
type: Workaround
label: "bound the child with WaitForExit and a tree kill"
---

## Definition

Start the child with Start-Process -PassThru and bound it with WaitForExit(ms); a false return is the deadline and the child's own ExitCode passes through untouched. Kill the whole tree, since a modern CLI is usually a launcher. Requires no POSIX timeout or alarm tool, so PATH order cannot substitute a different program.

