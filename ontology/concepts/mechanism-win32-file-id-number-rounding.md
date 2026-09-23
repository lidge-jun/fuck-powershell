---
id: mechanism-win32-file-id-number-rounding
type: Mechanism
label: "win32 file id number rounding"
---

## Definition

Bun 1.4.0 Windows stats expose 64-bit dev and ino values as JavaScript numbers, where distinct file IDs can round to the same represented value.
