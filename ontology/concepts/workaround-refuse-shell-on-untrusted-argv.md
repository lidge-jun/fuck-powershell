---
id: workaround-refuse-shell-on-untrusted-argv
type: Workaround
label: "refuse the shell fallback when argv carries untrusted text"
---

## Definition

Decide the cmd.exe fallback by inspecting argv contents for command separators rather than trusting a per-caller allowlist, and refuse to launch instead of falling back when unresolvable command and untrusted text coincide.
