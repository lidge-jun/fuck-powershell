---
id: mechanism-altgr-chord
type: Mechanism
label: "AltGr is reported as Ctrl+Alt"
---

## Definition

Windows implements right Alt as Ctrl plus Alt, so a character typed with AltGr arrives carrying both modifiers and any handler treating Ctrl as a shortcut prefix silently consumes real text, but only on layouts that need AltGr to produce it.
