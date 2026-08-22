---
id: mechanism-mandatory-file-locking
type: Mechanism
label: "mandatory file locking"
---

## Definition

Windows enforces file locks at the OS level: a handle opened without FILE_SHARE_DELETE blocks deletes and renames until it closes, where POSIX unlink only removes a name and lets the data outlive its last reference.
