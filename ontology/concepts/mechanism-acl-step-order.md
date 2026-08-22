---
id: mechanism-acl-step-order
type: Mechanism
label: "non-atomic ACL mutation order"
---

## Definition

Windows permissions are changed by a sequence of separate mutations with no atomic replace, and removing inheritance takes effect immediately, so an interrupted restrict-then-grant order leaves an empty DACL that denies everyone including the owner.
