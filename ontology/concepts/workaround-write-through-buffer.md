---
id: workaround-write-through-buffer
type: Workaround
label: "write bytes through the buffer, or pin newline empty"
---

## Definition

Encode and write through the binary buffer to bypass newline translation, or pass an empty newline argument when text mode is required, and normalize both sides of any round-trip comparison.
