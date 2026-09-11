---
id: mechanism-rem-parameter-substitution
type: Mechanism
label: "rem parameter substitution"
---

## Definition

REM and :: suppress command parsing, so operators and quotes inside a batch comment are inert. They do not suppress batch parameter substitution, which runs earlier, so a %~ form the parser cannot resolve aborts the script instead of being skipped.

