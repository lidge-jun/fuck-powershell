---
id: mechanism-crlf-residue
type: Mechanism
label: "CRLF residue after LF-only splitting"
---

## Definition

Windows tools end lines with CRLF, so splitting text on LF alone leaves a trailing CR on every line; exact comparisons and anchored patterns then fail against a character that is invisible in editors, diffs, and terminal output.
