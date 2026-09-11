---
id: mechanism-msys-path-conversion
type: Mechanism
label: "msys path conversion"
---

## Definition

MSYS2, which Git for Windows is built on, rewrites arguments that look like POSIX paths into Windows paths when launching a non-MSYS child. A lone switch such as /c is indistinguishable from a one-character root and arrives as C:/.

