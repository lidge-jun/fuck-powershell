# wp3 — Batch B: encoding and parsing

Four cases about bytes that change meaning between the editor that wrote them and the
parser that reads them.

**Rewritten after the audit.** Every claim is measured or attributed; see
`001_audit_and_measurements.md`.

## Files

### NEW `cases/encoding/cmd-bom-displaces-label.md`

`repro: verified`.

```yaml
---
id: cmd-bom-displaces-label
title: "a BOM is not whitespace, so it turns a batch label into a command and the next token is read as redirection"
category: encoding
versions: "both"
failure: hard-error
context: [agent, script, ci]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd, command-out-file]
  manifests_as: [error-unexpected-at-this-time]
  caused_by: [mechanism-bom-sniffing, mechanism-nonspace-prefix-kills-label]
  mitigated_by: [workaround-set-content-utf8nobom, workaround-strip-bom-at-every-read]
  related_to: [case:bomless-bat-oem-codepage]
---
```

- **Symptom** — a `.cmd` that is simultaneously valid batch and valid bash (the
  `: << 'BLOCK'` polyglot) stops working after an edit, with `<< was unexpected at this
  time`. On a Korean install the measured string is `<<은(는) 예상되지 않았습니다`, which is
  the same message localized — worth showing, because it is what a Korean developer will
  actually paste into a search box.
- **Repro** — measured, four variants of the same first line `: << 'CMDBLOCK'`:

  | file | result |
  |---|---|
  | no BOM | runs, exit 0 |
  | UTF-8 BOM | exit 255, `<<` unexpected |
  | one leading space | runs, exit 0 |
  | one leading tab | runs, exit 0 |

  The whitespace rows are the load-bearing ones: they are what proves the rule is about the
  BOM specifically and not about indentation. A second measured variant makes it concrete —
  a BOM in front of a plain `:tgt` label leaves the script running but reports
  `'<BOM>tgt' is not recognized`, because the label became a command.
- **Cause** — two rules meeting. A batch label is recognised when the colon is the first
  **non-whitespace** character; leading spaces and tabs are fine, and a BOM is not
  whitespace, so the line stops being a label. What remains is a line cmd.exe must parse as
  a command, and `<<` — bash's here-doc opener, meaningless in batch — is read as doubled
  input redirection. The error names the redirection, never the three invisible bytes, which
  is why this reads as a corrupt script rather than an encoding problem.
- **Workaround** — never emit a BOM (`Set-Content -Encoding utf8NoBOM` on 7.x; on 5.1
  `utf8NoBOM` does not exist, so write the bytes directly), and make it structural: strip a
  BOM on every read and emit none on every write, so a file that picks one up from an editor
  is repaired rather than diagnosed. Cross-link `bomless-bat-oem-codepage` for the other
  half of this trap, where the BOM fuses onto `@ECHO OFF` and reports a mangled command name.

### NEW `cases/encoding/autocrlf-shebang-cr.md`

`repro: historical` — and the case says why, because the tolerance result is the reason
this survives review.

```yaml
---
id: autocrlf-shebang-cr
title: "your Windows checkout writes CRLF into the shebang, Git Bash runs it anyway, and the Linux runner reports an interpreter that plainly exists as missing"
category: encoding
versions: "both"
failure: misleading-error
context: [ci, agent, script]
source: third-party
repro: historical
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/006716a3e19e0ddcabf05efae0de151b2c3b1a27
ontology:
  affects: [env-windows, env-actions-runner]
  invokes: [command-git]
  manifests_as: [error-bad-interpreter]
  caused_by: [mechanism-crlf-residue]
  mitigated_by: [workaround-gitattributes-eol-lf]
---
```

- **Symptom** — `bash: ./script.sh: /bin/bash^M: bad interpreter: No such file or
  directory`, on a machine where `/bin/bash` exists. Terminals often swallow the `^M`,
  leaving only "No such file or directory" for a file that is visibly right there. It
  appears on the CI runner, the container, or WSL — never on the Windows box that created it.
- **Repro** — two halves, and the case must be honest that only one was reproduced here:
  clone the same repository with `core.autocrlf=true` and `false`, then run the script from
  each. `od -c | head -1` shows the `\r`. On this machine, with `core.autocrlf=true`
  confirmed set, **a CRLF `#!/bin/bash` script ran cleanly under
  `C:\Program Files\Git\bin\bash.exe`**, both directly and via explicit `bash`.
- **Cause** — a shebang is read by whatever POSIX exec layer runs the file, and it takes
  everything after `#!` up to the newline. With CRLF the carriage return is part of the
  interpreter *name*, so the lookup is for a binary called `bash\r`. `core.autocrlf=true`
  converts on checkout, so the bytes in the repository are correct and only the working tree
  is wrong. The Windows NT loader never reads a shebang at all, which is why nothing on the
  authoring machine notices — and Git for Windows' own bash tolerates the carriage return,
  which removes the last local signal. The failure is deferred to the first real POSIX exec.
- **Verification note** — the Git Bash tolerance above is measured here. The
  `bad interpreter` failure itself is not reproducible on this host and is attributed to
  the cited sources; that asymmetry is the case's actual subject.
- **Workaround** — pin it in `.gitattributes` (`* text=auto eol=lf`) instead of trusting
  every contributor's git config, with explicit entries for files that must not be
  normalized. Note the inversion that makes a blanket rule dangerous: a polyglot `.cmd`
  dispatched by cmd.exe wants CRLF, so `eol=lf` everywhere trades this failure for
  `cmd-lf-drops-first-byte`.

### NEW `cases/parsing/config-string-eats-windows-path.md`

Renamed after audit: the strict JSON parser is the only layer that *catches* this, so
naming the case after JSON pointed at the wrong culprit. `repro: verified`.

```yaml
---
id: config-string-eats-windows-path
title: "the strict parser is the one that saves you: a Windows path in a loose config string loses every separator and fails much later under a filename nobody wrote"
category: parsing
versions: "both"
failure: misleading-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9
ontology:
  affects: [env-windows, runtime-node]
  invokes: [command-node]
  manifests_as: [error-module-not-found]
  caused_by: [mechanism-loose-string-escape-layer]
  mitigated_by: [workaround-forward-slashes-in-config]
  related_to: [case:git-merge-driver-sh-escapes]
---
```

- **Symptom** — `Cannot find module 'C:Userssmsmesrc\index.js'`. The path in the error is
  not the path in the config; the separators are gone and the words have been concatenated.
  The natural conclusion is that the tool writing the config has a bug — win-hooks records
  that it was misdiagnosed exactly that way.
- **Repro** — measured, the same bytes through three layers:

  ```
  source            : {"p": "C:\Users\smsme\src"}
  strict JSON.parse -> THROWS  Bad escaped character in JSON at position 10
  JS string literal -> "C:Userssmsmesrc"
  re-escaped, then JSON -> "C:\Users\smsme\src"
  import of the mangled value
    -> ERR_MODULE_NOT_FOUND: Cannot find module 'C:Userssmsmesrc\index.js'
  ```
- **Cause** — `\U` and `\s` are not valid escapes. A strict JSON parser refuses the
  document outright, which is the good outcome: you learn at load time. A loose layer — a JS
  string literal, JSON5, a hand-rolled config reader — drops the backslash and keeps the
  letter, so the damage is silent and surfaces later as a missing file. The Windows-specific
  part is that ordinary directory names (`Users`, `src`, `temp`, a username) are exactly
  the letters an escape layer consumes.
- **Workaround** — write drive-letter paths with forward slashes in configuration. Scope
  that claim: the loaders that consume these configs — Node, Python, `CreateFile` — accept
  them; `cd` in cmd.exe and some installers and schemas do not, so this is advice about
  config strings, not about Windows in general. If backslashes must survive, double them
  where the value is *generated* rather than repairing them downstream. Cross-link
  `git-merge-driver-sh-escapes` for the same class one layer down, where git's `sh` eats
  them instead.

### NEW `cases/env-paths/caller-picks-interpreter-not-shebang.md`

Renamed and re-caused after audit: the mechanism is the caller's choice, not PATHEXT.
`repro: verified` for the node half.

```yaml
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
```

- **Symptom** — `SyntaxError` on a file whose first line is `#!/bin/bash`. The error points
  into a shell script as though it were JavaScript or Python.
- **Repro** — measured: `#!/bin/bash` + `exit 0`, saved as `hook.py`, run as
  `node hook.py` → `SyntaxError: Unexpected number`, exit 1.
- **Cause** — separate the three dispatch paths rather than blurring them, which is what
  makes this case useful:
  1. **An explicit interpreter** (`node x`, `python x`) has already chosen. The shebang is
     never consulted. This is the measured case and by far the most common in agent tooling.
  2. **File association / ShellExecute** maps a suffix to a program — also contents-blind.
  3. **PATHEXT** governs extensionless PATH lookup, which is a different question again.

  None of them read `#!`. Windows is not shebang-free in general — `py.exe`, Git Bash and
  WSL all honour it — but none of those is in the chain when a tool spawns
  `python <file>`. So a file can be simultaneously a valid bash script and, to everything
  that runs it, Python. In practice this happens when a plugin ships a `.py` that is really
  bash, or when an update replaces the real script and leaves the name.
- **Workaround** — dispatch on the interpreter the file *declares*: read the shebang
  yourself, or record the interpreter in a descriptor beside the file. And when you need a
  file that is an inert no-op under an unknown interpreter, a bash shebang followed by
  `exit 0` is not it — `exit 0` is a syntax error to node (measured) and to python. A lone
  `#!/bin/sh` line and nothing else exits 0 under node (measured), and under bash and
  python, because all three read it as a comment. Scope that to those three: it says nothing
  about PowerShell or cmd.exe.
- **Verification note** — the python half of both results is attributed, not measured: this
  machine has no real CPython, only the Store alias, which is
  `windowsapps-python3-stub-needs-probe`.
- **Contrast** — `ps-file-extension-dispatch` is the same family with the opposite outcome:
  PowerShell *refuses* a script that is not `.ps1` instead of running it wrongly.

## New ontology concepts

| File | type | Definition |
|---|---|---|
| `mechanism-nonspace-prefix-kills-label.md` | Mechanism | A batch label is recognised when its colon is the first non-whitespace character; spaces and tabs are tolerated, but a BOM is not whitespace and turns the label into a command. |
| `mechanism-loose-string-escape-layer.md` | Mechanism | A loose string or config layer consumes a backslash as an escape introducer and keeps the following letter, so a Windows path silently loses its separators while a strict parser would refuse it. |
| `mechanism-caller-chosen-interpreter.md` | Mechanism | On Windows the caller, file association or PATHEXT selects the interpreter and none of them reads the shebang, so a script can run under a language it was not written in. |
| `error-unexpected-at-this-time.md` | ErrorSignature | cmd.exe reports a token it cannot place as "<token> was unexpected at this time", naming the token rather than the byte that displaced the line. |
| `error-bad-interpreter.md` | ErrorSignature | A POSIX exec layer reports the shebang target as missing, usually "bad interpreter: No such file or directory", naming an interpreter that exists. |
| `error-module-not-found.md` | ErrorSignature | A runtime reports "Cannot find module" for a path the author never wrote, because a layer between the config and the loader rewrote it. |
| `error-syntaxerror.md` | ErrorSignature | An interpreter reports a syntax error in a file that is valid in the language it was actually written in. |
| `workaround-strip-bom-at-every-read.md` | Workaround | Strip a BOM on every read and emit none on every write, so a file that acquires one from an editor is repaired rather than diagnosed. |
| `workaround-gitattributes-eol-lf.md` | Workaround | Pin line endings in .gitattributes rather than relying on each contributor's core.autocrlf, with explicit entries for files that must not be normalized. |
| `workaround-forward-slashes-in-config.md` | Workaround | Write drive-letter paths with forward slashes in configuration, which the loaders that consume them accept and no escape layer consumes. |
| `workaround-dispatch-by-declared-interpreter.md` | Workaround | Run a script with the interpreter it declares, read from its shebang or a descriptor, rather than the one its caller or suffix implies. |
| `workaround-tri-parser-noop.md` | Workaround | When a file must be inert under an unknown interpreter, use a lone #!/bin/sh line, which bash, python and node all read as a comment. |

Reused: `mechanism-bom-sniffing`, `mechanism-crlf-residue`, `shell-cmd`, `env-windows`,
`env-actions-runner`, `runtime-node`, `runtime-python`, `command-cmd`,
`command-out-file`, `command-git`, `command-node`, `workaround-set-content-utf8nobom`.

## Gate for this phase

```
bun scripts/lint-cases.mjs                                    # expect "106 cases OK"
bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs  # expect exit 0
bun scripts/fp.mjs errors bad-interpreter
```

