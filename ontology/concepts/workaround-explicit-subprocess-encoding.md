---
id: workaround-explicit-subprocess-encoding
type: Workaround
label: "capture bytes and choose the decoding per child"
---

## Definition

Capture subprocess output as bytes and decode explicitly per child rather than inheriting the locale default, and never pair a guessed encoding with replacement error handling, which converts a raised error into permanent corruption.
