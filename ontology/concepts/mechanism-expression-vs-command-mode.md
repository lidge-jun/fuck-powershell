---
id: mechanism-expression-vs-command-mode
type: Mechanism
label: "expression vs command mode"
---

## Definition

PowerShell chooses command or expression parsing from the first token of a line. A leading quoted string selects expression mode, so the string is a value and the argument after it is a syntax error, regardless of whether the path names an executable.

