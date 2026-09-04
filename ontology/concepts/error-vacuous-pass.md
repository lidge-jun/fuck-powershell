---
id: error-vacuous-pass
type: ErrorSignature
label: "vacuous pass"
---

## Definition

A test reports pass but its assertion cannot fail on this platform: the property it checks is never observed, so a broken implementation would pass identically. Worse than a failure because it is invisible.

