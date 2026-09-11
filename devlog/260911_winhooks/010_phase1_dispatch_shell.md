# wp2 — Batch A: dispatch and shell

Four cases about what happens between "I emitted a command line" and "something ran it".
All four come from win-hooks' dispatcher, the one file that has to be valid batch and
valid bash at the same time.

**This document was rewritten after the audit.** Every claim below is either measured on
this machine or explicitly attributed. Raw output: `001_audit_and_measurements.md`.
`related_to: [case:<stem>]` is confirmed correct and no longer a risk.

## Files

### NEW `cases/args-quoting/ps-quoted-path-is-expression.md`

`repro: verified` — the full three-dispatcher matrix was reproduced here.

```yaml
---
id: ps-quoted-path-is-expression
title: "a quoted path at the start of a line is an expression, not a command, so the line your tool emits runs under cmd.exe and dies under both PowerShells"
category: args-quoting
versions: "both"
failure: hard-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/0be564a1ed7d8d35e61d31e8b1a5a76d924a33bf
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, shell-cmd, env-windows]
  invokes: [command-cmd, command-powershell]
  manifests_as: [error-parsererror]
  caused_by: [mechanism-expression-vs-command-mode]
  mitigated_by: [workaround-call-operator, workaround-comspec-dispatch]
---
```

- **Symptom** — every hook a tool patched fails with exit 1, no output, no heartbeat. The
  emitted line is `"C:\...\run-hook.cmd" sessionstart`. Under cmd.exe it runs; under
  Windows PowerShell 5.1 and pwsh 7 alike it is a ParserError naming the *argument*:
  `Unexpected token 'sessionstart' in expression or statement`,
  `FullyQualifiedErrorId : UnexpectedToken`.
- **Repro** — reproduce the measured matrix. Target is a `.cmd` that echoes `%1`:

  | line | powershell 5.1 | pwsh 7 | cmd.exe |
  |---|---|---|---|
  | `"<path>" sessionstart` | ParserError, exit 1 | ParserError, exit 1 | `GOT=[sessionstart]`, exit 0 |
  | `cmd /c "<path>" sessionstart` | exit 0 | exit 0 | exit 0 |
  | `& "<path>" sessionstart` | exit 0 | exit 0 | n/a |

  Say how to measure it honestly: run the cmd.exe row from *inside* a `.cmd` file. Passing
  the line through a `spawnSync` argv adds another quoting layer and produces a false
  negative — that happened while measuring this case and is worth one sentence.
- **Cause** — PowerShell picks its parsing mode from the first token. A leading quoted
  string means expression mode, so the string is a value and the next token cannot follow
  it. Nothing about the path being executable changes that; the quote already decided. The
  class is bigger than the instance: **you do not choose the shell that runs what you
  emit.** The host does, and the two PowerShell editions install side by side and parse
  this identically — so the question is never which edition, only whether *a* PowerShell is
  in the chain.
- **Workaround** — `&` when you know PowerShell will parse the line; `cmd /c` when the
  dispatcher is unknown, because `cmd` is a command in all three and hands the quoted path
  to the cmd.exe you wanted. Warn that a test stopping at the first shell that works passes
  on a machine whose user drives the one it never reached. Then point at
  `msys-rewrites-slash-args`: `cmd /c` is not unconditionally safe either.

### NEW `cases/args-quoting/msys-rewrites-slash-args.md`

`repro: verified`.

```yaml
---
id: msys-rewrites-slash-args
title: "Git Bash rewrites /c into C:/ before the child sees it, so the cmd hop that fixed PowerShell breaks the moment bash is in the chain"
category: args-quoting
versions: "both"
failure: misleading-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/0be564a1ed7d8d35e61d31e8b1a5a76d924a33bf
ontology:
  affects: [shell-cmd, env-windows, runtime-node]
  invokes: [command-cmd]
  manifests_as: [error-command-not-recognized]
  caused_by: [mechanism-msys-path-conversion]
  mitigated_by: [workaround-msys-no-pathconv, workaround-per-dispatcher-command]
---
```

- **Symptom** — the `cmd /c "<path>" <arg>` that fixed the PowerShell chain starts
  reporting a nonsense path once a Git Bash hop is involved. `/c` never reaches cmd.exe.
- **Repro** — measured, with a child that prints its own argv:

  ```
  bash -c 'node argv.js /c /tmp/x //c'
    -> ARGV=["C:/", "C:/Users/you/AppData/Local/Temp/x", "/c"]
  MSYS_NO_PATHCONV=1 bash -c 'node argv.js /c /tmp/x //c'
    -> ARGV=["/c", "/tmp/x", "//c"]
  ```

  One line shows all three behaviours: `/c` becomes `C:/`, a real POSIX path is translated
  to its Windows equivalent, and `//c` is the escape that arrives as `/c`.
- **Cause** — MSYS2, which Git for Windows ships, converts arguments that look like POSIX
  paths on the way to a non-MSYS child. A lone `/c` is indistinguishable from an absolute
  path with a one-letter root. The conversion is correct for `/tmp/x` and destructive for a
  switch, and it happens in the launcher, so no amount of quoting inside the command helps.
- **Workaround** — `MSYS_NO_PATHCONV=1`, or the `//c` double-slash form, both measured
  above. Better: decide the prefix per dispatcher rather than emitting one line and hoping.
  win-hooks does exactly that — its Codex hook reference carries `cmd /c` and its Claude
  one deliberately does not, because Claude's chain can include Git Bash.

### NEW `cases/args-quoting/cmd-star-ignores-shift.md`

`repro: verified`. Retitled after audit: the eight-argument ceiling is a consequence of
the workaround, not a cmd.exe limit.

```yaml
---
id: cmd-star-ignores-shift
title: "shift renumbers %1 and leaves %* alone, so a batch wrapper cannot drop its own first argument and forward the rest"
category: args-quoting
versions: "both"
failure: silent
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/hooks/run-hook.cmd
  - https://github.com/LilMGenius/win-hooks/commit/632c5a8b37703599fbe15dbe85d748352b833352
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  caused_by: [mechanism-percent-star-unshifted]
  mitigated_by: [workaround-consume-arg-downstream]
---
```

`failure: silent`, so V6 does not require `manifests_as` and the case deliberately has
none: the ninth argument simply is not there.

- **Symptom** — a batch shim works for months, then a caller passes nine arguments and the
  ninth vanishes. No error, no truncation notice.
- **Repro** — measured, one file, three arguments:

  ```
  @echo off
  echo BEFORE_STAR=[%*]
  shift
  echo AFTER_STAR=[%*]
  echo AFTER_1=[%1]
  ```
  ```
  BEFORE_STAR=[one two three]  AFTER_STAR=[one two three]  AFTER_1=[two]
  ```
- **Cause** — `%*` is the original command tail as it arrived. `shift` renumbers
  `%1`..`%9` and does not touch it. A wrapper that must drop argument one therefore cannot
  use `%*` at all, and falls back to `%2 %3 %4 %5 %6 %7 %8 %9` — which is where the
  eight-argument ceiling comes from. State that plainly: the ceiling belongs to the
  workaround, not to cmd.exe.
- **Workaround** — do not consume the argument in batch. Forward `%*` untouched and let the
  program you dispatch read its own leading token; win-hooks' dispatcher reads the hook name
  in `run.mjs`, so nothing shifts and the cap disappears. For anyone keeping the positional
  form, quote each `"%~2"` so an argument containing spaces survives.

### NEW `cases/parsing/cmd-rem-substitutes-parameters.md`

`repro: verified`. **This case is the opposite of what both the plan and the reviewer
expected**, and the measurement is the whole point of it.

```yaml
---
id: cmd-rem-substitutes-parameters
title: "REM suppresses the command, not the substitution: & and | and quotes inside a comment are inert, and a %~ modifier in one kills the script"
category: parsing
versions: "both"
failure: hard-error
context: [agent, script, ci]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/hooks/run-hook.cmd
  - https://github.com/LilMGenius/win-hooks/commit/632c5a8b37703599fbe15dbe85d748352b833352
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  manifests_as: [error-invalid-batch-substitution]
  caused_by: [mechanism-rem-parameter-substitution]
  mitigated_by: [workaround-comment-outside-batch]
---
```

- **Symptom** — adding an explanatory comment to a working `.bat` breaks it, fatally, with
  an error about batch parameter substitution and a suggestion to read `CALL /?` or
  `FOR /?`. The script exits 255 and nothing after the comment runs.
- **Repro** — the measured table, which is what makes the case worth having:

  | line inside a `.cmd` | result |
  |---|---|
  | `REM use %TEMP%\foo & echo PWNED` | exit 0, no `PWNED` |
  | `REM redirect 2>nul here` | exit 0 |
  | `REM an unbalanced " quote` | exit 0 |
  | `REM piping a \| b here` | exit 0 |
  | `REM path is %TEMP%` | exit 0 |
  | `REM dir is %~dp0` | exit 0 |
  | `REM see the %~$PATH:I modifier` | **exit 255, fatal** |
  | `:: see the %~$PATH:I modifier` | **exit 255, fatal** |

- **Cause** — `REM` suppresses command parsing, so the operators everyone worries about
  are genuinely inert inside it. What it does not suppress is **batch parameter
  substitution**, which happens earlier; a well-formed `%~dp0` expands harmlessly, and a
  `%~` form the parser cannot resolve is a fatal error rather than a skipped comment. The
  usual advice — "use `::` instead" — does not help, because `::` is a label and labels
  are substituted too.
- **Workaround** — keep prose that names a `%~` modifier out of batch files entirely, or
  break the token so it cannot parse as a substitution. win-hooks writes the rule into its
  own dispatcher: "Never name that modifier in a REM: cmd.exe expands it there too and the
  comment breaks." Note the second-order trap while you are here: `::` inside a
  parenthesised block is itself a syntax error, so neither comment form is unconditionally
  safe.

## New ontology concepts

`ontology/concepts/<id>.md`, each with `id`, `type`, `label` and a `## Definition` under
400 characters (V8).

| File | type | Definition |
|---|---|---|
| `mechanism-expression-vs-command-mode.md` | Mechanism | PowerShell chooses command or expression parsing from the first token, so a leading quoted string makes the line a value and the following argument a syntax error. |
| `mechanism-msys-path-conversion.md` | Mechanism | MSYS2 rewrites arguments that look like POSIX paths into Windows paths when launching a non-MSYS child, so a lone switch such as /c arrives as C:/. |
| `mechanism-percent-star-unshifted.md` | Mechanism | cmd.exe expands %* to the command tail as it arrived and shift never changes it, so dropping an argument forces positional forwarding and its eight-argument ceiling. |
| `mechanism-rem-parameter-substitution.md` | Mechanism | REM and :: suppress command parsing but not batch parameter substitution, so an unresolvable %~ form inside a comment is a fatal error rather than a skipped line. |
| `error-invalid-batch-substitution.md` | ErrorSignature | cmd.exe rejects a %~ batch parameter substitution it cannot resolve and points the reader at CALL /? or FOR /?, aborting the script. |
| `workaround-call-operator.md` | Workaround | Invoke a quoted path with & so PowerShell parses the line in command mode instead of expression mode. |
| `workaround-msys-no-pathconv.md` | Workaround | Set MSYS_NO_PATHCONV=1, or double the leading slash, so MSYS hands the argument to the child unconverted. |
| `workaround-per-dispatcher-command.md` | Workaround | Emit a different command string per declared dispatcher instead of one line assumed valid under every shell a host might use. |
| `workaround-consume-arg-downstream.md` | Workaround | Forward %* untouched and let the dispatched program read its own leading argument, so nothing shifts and no ceiling appears. |
| `workaround-comment-outside-batch.md` | Workaround | Keep prose naming a %~ modifier out of batch files, since REM and :: both still perform batch parameter substitution. |

Reused, already present: `shell-powershell-51`, `shell-pwsh-7`, `shell-cmd`,
`env-windows`, `runtime-node`, `command-cmd`, `command-powershell`,
`error-parsererror`, `error-command-not-recognized`, `workaround-comspec-dispatch`.

## Gate for this phase

```
bun scripts/lint-cases.mjs                                    # expect "102 cases OK"
bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs  # expect exit 0
bun scripts/fp.mjs case ps-quoted-path-is-expression
```

