---
id: workaround-normalize-separators-first
type: Workaround
label: "normalize separators before splitting a client-supplied path"
---

## Definition

Replace backslashes with forward slashes before splitting or basenaming a path that arrived as data, or use the explicitly win32 path functions, since the ambient POSIX build treats a backslash as an ordinary filename character.
