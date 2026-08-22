---
id: mechanism-win32-path-normalization
type: Mechanism
label: "win32 path normalization"
---

## Definition

Win32 trims trailing dots/spaces from paths at the API boundary; different runtimes normalize differently, so existence checks disagree.
