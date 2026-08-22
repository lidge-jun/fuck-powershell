---
id: mechanism-command-line-cap
type: Mechanism
label: "CreateProcess command line capped at 32767"
---

## Definition

CreateProcess limits the whole assembled command line to 32767 characters and reports the overflow with the same Win32 code used for an over-long path, so a payload passed as an argument fails under an error that describes filenames.
