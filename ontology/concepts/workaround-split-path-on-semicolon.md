---
id: workaround-split-path-on-semicolon
type: Workaround
label: "detect an unmatched quote in PATH and say so"
---

## Definition

Count quote characters in PATH and report an odd total as the real fault, since a quote-aware split will otherwise fail silently while the shell's own resolution keeps working and hides the cause.
