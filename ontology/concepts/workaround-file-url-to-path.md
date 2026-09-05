---
id: workaround-file-url-to-path
type: Workaround
label: "file url to path"
---

## Definition

Convert import.meta.url-derived URLs with fileURLToPath before handing them to spawn, fs, or a runtime CLI; pathname is never a filesystem path on Windows.
