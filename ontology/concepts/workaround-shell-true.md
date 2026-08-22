---
id: workaround-shell-true
type: Workaround
label: "shell true"
---

## Definition

Pass shell:true to spawn so cmd.exe resolves the shim.

## Why it's unsafe

Node does not escape cmd metacharacters for you: any untrusted text in argv becomes command injection (& | newline). CVE-2024-27980's fix exists precisely because this path is dangerous. Use ComSpec dispatch with controlled quoting instead.
