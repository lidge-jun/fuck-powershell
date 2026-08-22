---
id: mechanism-universal-newline-write
type: Mechanism
label: "text-mode write translates newlines"
---

## Definition

CPython text I/O applies universal newlines when writing as well as reading, so a lone line feed becomes the platform terminator wherever a TextIOWrapper sits in the path, including inside a subprocess pipe opened in text mode.
