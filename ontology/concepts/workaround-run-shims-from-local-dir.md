---
id: workaround-run-shims-from-local-dir
type: Workaround
label: "run batch shims from a drive-backed directory"
---

## Definition

Push into a local directory before invoking a batch shim and pass absolute paths as arguments, or map the UNC location to a drive letter, since the shell objects to being in a UNC path rather than to receiving one.
