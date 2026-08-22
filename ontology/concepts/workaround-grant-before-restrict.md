---
id: workaround-grant-before-restrict
type: Workaround
label: "grant access before removing inheritance"
---

## Definition

Order ACL hardening so an explicit owner grant lands before inheritance is stripped, leaving every interruption point in a state where the target is still reachable and the sequence can be re-run.
