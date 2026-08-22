---
id: mechanism-native-argv-rebuild
type: Mechanism
label: "native argv rebuild"
---

## Definition

PowerShell historically rebuilds one command-line string for native processes, re-quoting heuristically; quotes and empty args are lost.
