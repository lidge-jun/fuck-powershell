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

# REM suppresses the command, not the substitution: & and | and quotes inside a comment are inert, and a %~ modifier in one kills the script

## Symptom

You documented a working `.bat` and broke it. The only change was a comment. The
script now dies immediately, exit 255, with an error about batch parameter
substitution that suggests you read `CALL /?` or `FOR /?`:

```
The following usage of the path operator in batch-parameter
substitution is invalid: %~$PATH:I modifier
For valid formats type CALL /? or FOR /?
```

Nothing after the comment runs.

## Repro

The table is the case. Each row is one `.cmd` whose only difference is the comment
line, followed by `echo MARKER_OK`:

| comment line | result |
|---|---|
| `REM use %TEMP%\foo & echo PWNED` | exit 0, `MARKER_OK`, and no `PWNED` |
| `REM redirect 2>nul here` | exit 0 |
| `REM an unbalanced " quote` | exit 0 |
| `REM piping a \| b here` | exit 0 |
| `REM path is %TEMP%` | exit 0 |
| `REM dir is %~dp0` | exit 0 |
| `REM see the %~$PATH:I modifier` | **exit 255, fatal** |
| `:: see the %~$PATH:I modifier` | **exit 255, fatal** |

Measured on Windows 11. Note which rows are green: the operators everyone warns
about are genuinely inert, and so is an ordinary environment variable.

## Cause

The usual folklore — "cmd.exe still parses `&` and `|` inside a `REM`" — is
wrong, and the measurements above say so. `REM` does suppress command parsing.

What it does not suppress is **batch parameter substitution**, which happens
earlier in the line's life. A well-formed substitution expands harmlessly:
`%~dp0` inside a comment just becomes a directory nobody looks at. A `%~` form the
parser cannot resolve is not skipped and not warned about — it aborts the script.

`::` is not an escape hatch. It is a label, and labels are substituted too, so it
fails identically.

This is a nasty shape for a documentation habit: the more precisely you describe
what the next line does, the more likely you are to write the token that kills the
file. win-hooks has the rule in its own dispatcher, for exactly this reason —
"Never name that modifier in a REM: cmd.exe expands it there too and the comment
breaks."

## Workaround

Keep prose that names a `%~` form out of the batch file. If the explanation has to
live next to the code, break the token so it cannot parse as a substitution:

```bat
REM resolved by the FOR path-search modifier (see FOR /? - do not spell it here)
for %%I in (node.exe) do set "WH_NODE=%%~$PATH:I"
```

The working line still contains the modifier, because there it is inside a `FOR`
that defines `%%I` and resolves correctly. Only the comment, which defines nothing,
cannot resolve it.

Two more things worth knowing before you reach for a comment form you trust less:

- `::` inside a parenthesised block is a syntax error in its own right, so it is
  not a safer default than `REM`.
- A `REM` at the end of a line continued with `^` still swallows the continuation,
  which is a different way to lose the line after your comment.

## What this does not mean

It does not mean batch comments are dangerous in general. Six of the eight rows
above are green, including the ones with `&`, `|`, `>` and an unbalanced quote.
The rule is narrow and worth memorising exactly as narrow: a `%~` that cannot
resolve is fatal wherever it appears, and a comment is not a place cmd.exe stops
looking.

