---
id: workaround-kill-process-tree
type: Workaround
label: "kill the process tree and drain handles before exit"
---

## Definition

Give shutdown a grace period that closes servers, database handles, and child processes, and terminate descendants explicitly with taskkill /T, since Windows has no POSIX process group to signal.
