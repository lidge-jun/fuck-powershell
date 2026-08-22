---
id: error-fastfail
type: ErrorSignature
label: "0xC0000409 STATUS_STACK_BUFFER_OVERRUN"
---

## Definition

Windows reports a runtime that aborted itself with the fastfail code 0xC0000409, whose documented meaning is stack buffer overrun; a libuv assertion during teardown surfaces this way and misdescribes the cause.
