---
id: mechanism-test-resource-outlives-file
type: Mechanism
label: "test resource outlives file"
---

## Definition

A test finishes without clearing its deadline or awaiting request/socket teardown, leaving timers or handles active in the shared test process after the file ends.
