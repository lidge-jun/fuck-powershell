---
id: mechanism-nonspace-prefix-kills-label
type: Mechanism
label: "nonspace prefix kills label"
---

## Definition

A batch label is recognised when its colon is the first non-whitespace character of the line. Spaces and tabs are tolerated; a BOM is not whitespace, so it turns the label into a command cmd.exe must parse.

