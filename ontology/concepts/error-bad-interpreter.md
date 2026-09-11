---
id: error-bad-interpreter
type: ErrorSignature
label: "bad interpreter"
---

## Definition

A POSIX exec layer reports the shebang target as missing, usually 'bad interpreter: No such file or directory', naming an interpreter that exists. A trailing carriage return inside the name is the usual cause.

