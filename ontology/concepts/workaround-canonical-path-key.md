---
id: workaround-canonical-path-key
type: Workaround
label: "canonicalize a path before using it as a key"
---

## Definition

Resolve the path, normalize separators, and lowercase only on Windows before using it as a map or config key, applying the same canonicalization on write as on read so a persisted store cannot hold two spellings of one file.
