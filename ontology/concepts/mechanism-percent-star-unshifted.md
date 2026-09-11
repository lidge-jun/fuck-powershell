---
id: mechanism-percent-star-unshifted
type: Mechanism
label: "percent-star unshifted"
---

## Definition

cmd.exe expands %* to the command tail exactly as it arrived, and shift renumbers only %1 through %9. A batch file that must drop its first argument therefore has no correct expansion, and falls back to positional forwarding with its eight-argument ceiling.

