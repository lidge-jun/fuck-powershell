---
id: mechanism-locale-preferred-encoding
type: Mechanism
label: "locale preferred encoding is the ANSI codepage"
---

## Definition

Python text mode without an explicit encoding decodes with the locale preferred encoding, which on Windows is the ANSI codepage rather than UTF-8, and UTF-8 mode changes what that function reports without changing what native children emit.
