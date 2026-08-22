---
id: mechanism-quoted-path-entry
type: Mechanism
label: "PATH entries may be quoted"
---

## Definition

A Windows PATH entry may be wrapped in quotes so a directory name can contain a semicolon, which forces correct parsers to be quote-aware; an unmatched quote then opens a span that swallows every later entry into one fictional path.
