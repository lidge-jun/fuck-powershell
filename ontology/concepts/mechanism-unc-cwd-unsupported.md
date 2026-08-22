---
id: mechanism-unc-cwd-unsupported
type: Mechanism
label: "cmd.exe cannot hold a UNC current directory"
---

## Definition

The current directory is drive-relative in cmd.exe's model, so a UNC path cannot be one; started in a UNC directory it warns and silently relocates to the Windows directory, and every batch shim that hops through it inherits the wrong working directory.
