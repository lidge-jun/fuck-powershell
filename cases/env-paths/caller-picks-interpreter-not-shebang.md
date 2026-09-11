---
id: caller-picks-interpreter-not-shebang
title: "the caller picks the interpreter and never reads your shebang, so a bash script handed to node dies as a SyntaxError in a language it was never written in"
category: env-paths
versions: "both"
failure: hard-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/ed2d8e8332ce611ec29e6cc9a3aacd1132efb89e
ontology:
  affects: [env-windows, runtime-node, runtime-python]
  invokes: [command-node]
  manifests_as: [error-syntaxerror]
  caused_by: [mechanism-caller-chosen-interpreter]
  mitigated_by: [workaround-dispatch-by-declared-interpreter, workaround-tri-parser-noop]
  related_to: [case:ps-file-extension-dispatch]
---

# the caller picks the interpreter and never reads your shebang, so a bash script handed to node dies as a SyntaxError in a language it was never written in

## Symptom

A `SyntaxError` in a file whose first line is `#!/bin/bash`. The interpreter
points into a shell script as though it were JavaScript or Python, and the caret
lands on a perfectly ordinary shell statement.

```
C:\...\hook.py:2
exit 0
     ^
SyntaxError: Unexpected number
```

## Repro

Save two bash lines as `hook.py` and hand the file to node:

```
#!/bin/bash
exit 0
```
```
node hook.py   -> SyntaxError: Unexpected number, exit 1
```

Measured on Node 24. The shebang line survives, because `#` happens to start a
comment in several languages. The second line is where the impersonation ends.

## Cause

`#!` is a Unix kernel convention. Nothing in the Windows dispatch path implements
it, and it is worth separating the three paths rather than blurring them into
"Windows ignores shebangs":

1. **An explicit interpreter.** `node x`, `python x`, `bash x`. The caller has
   already chosen; the file's contents are never consulted. This is the measured
   case and by far the most common in agent and plugin tooling, where a config
   entry says `python3 <script>` and nobody re-checks what the script is.
2. **File association / ShellExecute.** A suffix is mapped to a program. Also
   contents-blind, and it is the mechanism behind double-clicking.
3. **PATHEXT.** Governs which extensions an *extensionless* PATH lookup will try.
   A different question again, and the one covered by `pathext-bare-name-enoent`.

Windows is not shebang-free in general — `py.exe`, Git Bash and WSL all honour
`#!`. But none of them is in the chain when a tool spawns `python <file>`. So a
file can be simultaneously a valid bash script and, to everything that actually
runs it, Python.

In practice this happens when a plugin ships a `.py` that is really bash, or when
an upstream update overwrites the real script and leaves the filename behind.

## Workaround

Dispatch on the interpreter the file **declares**, not the one its name or its
caller implies: read the shebang yourself and spawn that, or record the interpreter
in a descriptor next to the file so the decision is data rather than a guess.

The second half matters if you are writing a repair. When you need a file that is
an inert no-op under an interpreter you cannot predict, the obvious body is wrong:

```sh
#!/bin/bash
exit 0        # SyntaxError under node (measured) and under python
```

```sh
#!/bin/sh
              # exits 0 under node (measured), and under bash and python
```

A lone `#!/bin/sh` line and nothing else is read as a comment by all three, so it
exits 0 whoever runs it. Scope that to those three: it says nothing about
PowerShell or cmd.exe, where `#` is not a comment introducer in the same way.

win-hooks arrived at the same body the hard way — its first repair used the bash
shebang plus `exit 0`, and the repaired hook kept failing with the very message it
had been repaired for.

## Verification note

The python half of both results above is attributed rather than measured: this
host has no real CPython, only the Microsoft Store alias, which is its own case
(`windowsapps-python3-stub-needs-probe`). The node half is measured.

## Contrast

`ps-file-extension-dispatch` is the same family with the opposite outcome:
`powershell -File` **refuses** a script that is not named `.ps1` instead of running
it wrongly. One dispatcher checks the suffix and declines; the others do not check
anything and proceed. Knowing which kind you are talking to is the whole skill.

