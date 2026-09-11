---
id: mechanism-inert-file-association
type: Mechanism
label: "inert file association"
---

## Definition

A file extension is registered but its association carries no executing verb, so shell-level dispatchers resolve it, do nothing and return success, while CreateProcess refuses the same file outright.

