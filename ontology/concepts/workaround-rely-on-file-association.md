---
id: workaround-rely-on-file-association
type: Workaround
label: "rely on file association"
---

## Definition

Register or depend on a file association so a script extension becomes runnable by name.

## Why it's unsafe

It is a machine-wide change made on the user's behalf that behaves differently on every box, and the variant tools reach for instead - prepending an interpreter to any command containing the extension - double-dispatches when the command already names one, turning 'bash script.sh' into 'bash bash script.sh'. Name the interpreter at the call site instead.

