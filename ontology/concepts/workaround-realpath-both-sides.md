---
id: workaround-realpath-both-sides
type: Workaround
label: "resolve both sides before comparing paths"
---

## Definition

Convert a file URL with fileURLToPath and realpath both operands before comparing, so URL form, separator direction, drive-letter case, and symlinks cannot make one file look like two.
