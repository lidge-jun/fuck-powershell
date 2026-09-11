---
id: mechanism-empty-print-name
type: Mechanism
label: "reparse point written without a print name"
---

## Definition

A mount-point reparse point stores a substitute name in the NT object namespace and a print name in Win32 form. A buffer built by hand often carries only the substitute name, so the kernel still resolves the link while Win32 path resolution through it yields nothing — and an empty directory is not an error, so every caller reports success.
