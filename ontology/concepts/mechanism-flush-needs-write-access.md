---
id: mechanism-flush-needs-write-access
type: Mechanism
label: "flush needs write access"
---

## Definition

On Windows fsync is FlushFileBuffers, which requires a handle opened with GENERIC_WRITE; a read-only handle is refused with ERROR_ACCESS_DENIED (EPERM), where POSIX fsync accepts any descriptor for the file.
