---
id: workaround-treat-ctrl-alt-as-literal
type: Workaround
label: "treat a printable Ctrl+Alt chord as literal input"
---

## Definition

Route a Ctrl+Alt chord carrying a printable character to the text-insert path rather than to binding dispatch, and reserve shortcuts for Ctrl alone, since Ctrl+Alt bindings are unsafe on Windows layouts that need AltGr.
