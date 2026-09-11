---
id: mechanism-sh-escape-processing
type: Mechanism
label: "config command line is parsed by sh before the program is found"
---

## Definition

Git runs commands supplied through configuration by handing them to its bundled sh, so the configured value is a shell command line rather than an argv vector. Backslashes in a Windows path are consumed as escape characters before any program lookup happens, and the resulting 'command not found' is absorbed by whatever fallback the calling feature defines.

