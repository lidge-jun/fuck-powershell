---
id: workaround-spy-the-syscall-not-the-metadata
type: Workaround
label: "spy the syscall not the metadata"
---

## Definition

To prove "this code read that file", record calls to readFileSync (a pass-through spy filtered to the exact path) instead of watching filesystem metadata like atime, which platforms may not maintain. Validate the observer with an ablation that must turn the negative case red.

