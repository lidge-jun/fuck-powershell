---
id: mechanism-drive-letter-as-scheme
type: Mechanism
label: "drive letter parses as a URL scheme"
---

## Definition

A Windows absolute path begins with a drive letter and colon, so any API that parses its input as a URL reads that letter as the protocol, while an absolute POSIX path coincidentally parses as root-relative and works.
