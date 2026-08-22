---
id: workaround-job-object-or-scoped-tree-kill
type: Workaround
label: "use a job object, or break ancestry before a tree kill"
---

## Definition

Assign children to a job object so membership is explicit and closing it kills exactly those processes, or detach the target from your own ancestry before using a parent-chain tree kill, and verify the processes are gone rather than trusting the call.
