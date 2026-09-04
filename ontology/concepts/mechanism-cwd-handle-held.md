---
id: mechanism-cwd-handle-held
type: Mechanism
label: "cwd handle held"
---

## Definition

Windows holds a process's current directory as an open handle without FILE_SHARE_DELETE for as long as it is the cwd, so the directory cannot be unlinked until some process chdir()s away. POSIX keeps only an inode reference, so the name can go while the process stays inside.

