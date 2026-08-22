---
id: workaround-write-bat-crlf
type: Workaround
label: "write batch files with CRLF and pin it in gitattributes"
---

## Definition

Emit carriage-return line feed pairs when generating batch files, pin the ending in gitattributes so a checkout cannot revert it, and scan for carriage-return-free scripts since the interpreter never names the terminator as the fault.
