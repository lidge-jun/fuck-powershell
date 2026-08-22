---
id: workaround-node-script-not-shell
type: Workaround
label: "move logic into a script file, not the script string"
---

## Definition

Replace shell-dependent package script strings with a call to a real program file, so the logic runs in a runtime that behaves the same on every host instead of in whichever shell the package manager picks.
