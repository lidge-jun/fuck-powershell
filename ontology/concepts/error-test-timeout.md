---
id: error-test-timeout
type: ErrorSignature
label: "test timeout"
---

## Definition

"this test timed out after N ms" from the test runner: the body was aborted, not an assertion. Children it spawned are still running until the runner reaps them at the end.

