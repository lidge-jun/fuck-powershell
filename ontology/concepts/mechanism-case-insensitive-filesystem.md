---
id: mechanism-case-insensitive-filesystem
type: Mechanism
label: "case-insensitive filesystem, case-sensitive containers"
---

## Definition

NTFS matches paths without regard to case while preserving the casing written, so two spellings name one file, but every ordinary string container treats them as distinct keys and the same lowercasing fix would be wrong on a case-sensitive filesystem.
