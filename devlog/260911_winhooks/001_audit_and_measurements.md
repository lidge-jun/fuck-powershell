# 001 — audit and measurements

The roadmap in `000_plan.md` was written from win-hooks' prose. An independent
`xai/grok-4.6` reviewer then audited it against this repository and returned **FAIL**
with thirteen defects, several of the form "you have not measured this."

So it was measured. `evidence/probe.mjs`, `probe2.mjs` and `probe3.mjs` write fixtures
into a temp directory and run them on this machine — Windows 11, Korean system locale,
Windows PowerShell 5.1 and pwsh 7 side by side, Git for Windows present, Python present
only as a Store alias. Everything below is output from those three scripts.

## What the measurements confirmed

**The three-dispatcher matrix (`ps-quoted-path-is-expression`).** Exact, and it is the
cleanest result of the round. The emitted line is `"<path>\echoarg.cmd" sessionstart`:

| line | powershell 5.1 | pwsh 7 | cmd.exe |
|---|---|---|---|
| `"<path>" sessionstart` | ParserError, exit 1 | ParserError, exit 1 | `GOT=[sessionstart]`, exit 0 |
| `cmd /c "<path>" sessionstart` | exit 0 | exit 0 | exit 0 |
| `& "<path>" sessionstart` | exit 0 | exit 0 | n/a |

5.1 reports `FullyQualifiedErrorId : UnexpectedToken` and points at `sessionstart`;
pwsh 7 reports the same ParserError. The cmd.exe row was run from inside a `.cmd` file so
that no other layer re-quoted the line — an earlier attempt passed it through
`spawnSync` and produced a false negative, which is recorded here because it is the
easy way to measure this wrong.

**`%*` does not follow `shift`.** One run, no ambiguity:

```
BEFORE_STAR=[one two three]  AFTER_STAR=[one two three]  AFTER_1=[two]
```

**MSYS argument conversion.** A node child printing its own argv, invoked through
`C:\Program Files\Git\bin\bash.exe`:

```
bash -c 'node argv.js /c /tmp/x //c'
  -> ARGV=["C:/", "C:/Users/you/AppData/Local/Temp/x", "/c"]
MSYS_NO_PATHCONV=1 bash -c 'node argv.js /c /tmp/x //c'
  -> ARGV=["/c", "/tmp/x", "//c"]
```

Both documented escapes work, and `//c` collapsing to `/c` is visible in the same line.

**The BOM and the batch label.** The polyglot first line `: << 'CMDBLOCK'`:

| file | result |
|---|---|
| no BOM | `MARKER_OK`, exit 0 |
| UTF-8 BOM | exit 255, `<<은(는) 예상되지 않았습니다` — the localized "`<<` was unexpected at this time" |
| one leading space | `MARKER_OK`, exit 0 |
| one leading tab | `MARKER_OK`, exit 0 |

**The Microsoft Store interpreter alias.** On this machine:

```
where python3 -> C:\Users\you\AppData\Local\Microsoft\WindowsApps\python3.exe
where python  -> C:\Users\you\AppData\Local\Microsoft\WindowsApps\python.exe
python3 -c ''  -> exit 9009, "Python was not found; run without arguments to install
                  from the Microsoft Store, or disable this shortcut from Settings >
                  Apps > Advanced app settings > App execution aliases."
python  -c ''  -> exit 9009, same message
```

`where.exe` succeeds for both names; neither is an interpreter. Exit code 9009, not EPERM.

**A bash body under the wrong interpreter.** `#!/bin/bash` + `exit 0`, saved as `hook.py`
and handed to node: `SyntaxError: Unexpected number`, exit 1. A file containing only
`#!/bin/sh` exits 0 under node. The python half of that claim could not be measured here,
because this machine has no real Python — which is itself the previous finding.

**A Windows path through three config layers.** Source bytes
`{"p": "C:\Users\smsme\src"}`:

```
strict JSON.parse    -> THROWS  Bad escaped character in JSON at position 10
JS string literal    -> "C:Userssmsmesrc"
re-escaped, then JSON-> "C:\Users\smsme\src"
import of the mangled value
  -> ERR_MODULE_NOT_FOUND: Cannot find module 'C:Userssmsmesrc\index.js'
```

The strict parser is the only layer that refuses. The loose one silently eats every
separator and the failure arrives much later, under a filename nobody wrote.

## What the measurements contradicted

**`REM` is not what either of us said.** The roadmap claimed `REM` still parses `&`,
`|`, `>` and quotes; the reviewer proposed `REM ... & echo PWNED` as a better repro.
Both are wrong:

| line inside a `.cmd` | result |
|---|---|
| `REM use %TEMP%\foo & echo PWNED` | exit 0, `MARKER_OK`, no `PWNED` |
| `REM redirect 2>nul here` | exit 0 |
| `REM an unbalanced " quote` | exit 0 |
| `REM piping a \| b here` | exit 0 |
| `REM path is %TEMP%` | exit 0 |
| `REM dir is %~dp0` | exit 0 |
| **`REM see the %~$PATH:I modifier`** | **exit 255, fatal** |
| `:: see the %~$PATH:I modifier` | exit 255, fatal — identical |

`REM` does suppress command parsing. What it does not suppress is **batch parameter
substitution**, and an invalid `%~` substitution is a fatal error rather than a skipped
comment: `일괄 매개 변수 대체값에 잘못된 대체 구문... CALL /? 또는 FOR /?`. So the case is
narrower and stranger than planned: ordinary `%VAR%` and even `%~dp0` are harmless, and
the thing that kills the script is documenting a `%~` modifier. `::` behaves identically,
so the usual "use `::` instead" advice does not help.

**A batch label tolerates leading whitespace.** The reviewer was right. A space and a tab
both still produce a working label; the BOM does not. The mechanism is a *non-whitespace*
prefix, not column zero.

**The CRLF shebang did not reproduce here.** `core.autocrlf` is `true` on this machine,
and a `#!/bin/bash` script saved with CRLF still ran cleanly under
`C:\Program Files\Git\bin\bash.exe`, both by direct execution and via explicit `bash`.
Git for Windows tolerates the carriage return. That does not delete the landmine — it
relocates it, and explains why it survives local testing: the machine that creates the
CRLF is the machine that cannot see the damage. The failure belongs to a real POSIX exec
(a Linux runner, a container, WSL), which is not reproducible from here. The case ships
`repro: historical` with this tolerance result recorded as the reason it is not
`verified`.

**`where bash` is not the WSL launcher here.** It returns
`C:\Program Files\Git\usr\bin\bash.exe` first, and the WindowsApps alias second. The
planned title — "the bash on your PATH is the WSL launcher" — is false on any machine
with Git for Windows, which the reviewer flagged and the measurement confirms. The case
is rescoped to the machine win-hooks describes: no Git for Windows, where the first (and
only) `bash` on PATH is the launcher alias. The exit-0-on-failure behaviour could not be
measured here and stays attributed to win-hooks, in a verification note.

## Dispositions

| # | Reviewer defect | Disposition |
|---|---|---|
| 1 | REM repro will not break | **Rebutted and both corrected.** `%~$PATH:I` is fatal (exit 255); the reviewer's `&` alternative is not. New mechanism and new error signature |
| 2 | "column zero" overstates the label rule | **Folded.** Mechanism renamed to a non-whitespace prefix; whitespace tolerance measured |
| 3 | Korean string mapped to the wrong signature | **Folded.** The invented string is replaced by the measured one, which is the localized "was unexpected at this time" |
| 4 | WSL bash claims overstated | **Folded.** Rescoped to a Git-less machine; exit-0 claim attributed, not asserted |
| 5 | "the kernel" reads the shebang | **Folded.** Attributed to the POSIX emulation layer, and the case now leads with Git Bash tolerating it |
| 6 | extension/association/PATHEXT conflated | **Folded.** The case is now "the caller picks the interpreter", with the three paths separated |
| 7 | `mechanism-extension-dispatch` is PowerShell-only | **Folded.** New mechanism rather than bending an existing definition |
| 8 | `mechanism-appexeclink` is the EPERM mechanism | **Folded.** New mechanism for the alias that runs and prints; 9009 measured |
| 9 | `command -v` is not a Windows probe | **Folded.** Repro uses `where.exe`; `command-command` dropped from `invokes` |
| 10 | "forward slashes work everywhere" | **Folded.** Scoped to the loaders that consume the config |
| 11 | title blends `%*` with the 8-argument cap | **Folded.** Retitled to the `%*`/`shift` mismatch |
| 12 | the timeout case is host policy, which this round excluded | **Folded by removal.** The case is dropped; the round is 10, not 11 |
| 13 | do not imply the `#!/bin/sh` no-op is safe everywhere | **Folded.** Scoped to bash, python and node |
| — | `invokes: [command-convertfrom-json]` is the wrong command | **Folded.** Dropped |
| — | `workaround-windowsapps-path-heuristic` duplicates `workaround-skip-windowsapps` | **Folded.** The existing node is reused as the `unsafe_fix` target and gains a `## Why it's unsafe` section naming the split |

## Still unverified after this pass

Recorded so the cases can say so rather than imply otherwise.

- WSL's `bash.exe` returning exit 0 after failing to open a Windows path. No WSL on this
  machine; attributed to win-hooks.
- The `bad interpreter: ^M` failure itself, as opposed to Git Bash tolerating it.
- `#!/bin/bash` + `exit 0` under a real CPython.
- Whether `fp preflight` surfaces the new cases usefully — that is wp5's check, not a claim.
