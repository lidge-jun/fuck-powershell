---
id: mechanism-dos-device-namespace
type: Mechanism
label: "MS-DOS device names reserved in every directory"
---

## Definition

Win32 path parsing recognizes legacy device names such as CON, NUL, and COM1 as their own path type and rewrites them into the NT device namespace before any directory applies, with or without an extension, so opening one succeeds as a device rather than creating a file.
