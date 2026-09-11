---
id: workaround-strip-bom-at-every-read
type: Workaround
label: "strip bom at every read"
---

## Definition

Strip a BOM on every read and emit none on every write, so a file that acquires one from an editor is repaired the next time anything touches it rather than waiting to be diagnosed.

