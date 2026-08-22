---
id: cmd-lf-drops-first-byte
title: "a batch file saved with Unix line endings makes cmd.exe eat the first byte of lines, so npm becomes pm and powershell becomes hell"
category: encoding
versions: "both"
failure: misleading-error
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/49
  - https://github.com/openclaw/openclaw/issues/119484
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  manifests_as: [error-command-not-recognized]
  caused_by: [mechanism-crlf-residue]
  mitigated_by: [workaround-write-bat-crlf]
---

# a batch file saved with Unix line endings makes cmd.exe eat the first byte of lines, so npm becomes pm and powershell becomes hell

## Symptom

A batch script fails with errors naming commands that are not in the file:

```
'pm' is not recognized as an internal or external command
'hell' is not recognized as an internal or external command
```

The file plainly says `call npm install` and `powershell -File ...`. The first
character of the token is gone. Nested `if` and `for` blocks silently do not run,
loops break, and none of it is consistent — the same file can fail differently on
different runs.

There is no encoding error, no syntax error, and no mention of line endings
anywhere in the output.

## Repro

Write a `.cmd` with LF-only endings, which is the default for most editors and
every AI coding agent:

```powershell
PS> [IO.File]::WriteAllText("t.cmd", "@echo off" + [char]10 + "npm --version" + [char]10)
PS> Format-Hex t.cmd | Select-String "0D 0A"    # nothing: no CRLF pair
PS> cmd /c t.cmd
'pm' is not recognized as an internal or external command
```

Rewriting the identical text with CRLF fixes it:

```powershell
PS> [IO.File]::WriteAllText("t.cmd", "@echo off" + [char]13 + [char]10 + "npm --version" + [char]13 + [char]10)
PS> cmd /c t.cmd     # runs
```

## Cause

cmd.exe's batch interpreter was built for CRLF and reads a script by seeking
through the file as it executes rather than parsing it whole. Its line handling
assumes a two-byte terminator, so on an LF-only file the seek arithmetic lands one
byte off and the first character of a line is consumed as if it were the missing
CR.

That is why the failures look random: whether a given line loses its first byte
depends on where the interpreter's file position happens to be, which depends on
everything before it. Add a line at the top and a different line breaks. Block
constructs — `if`, `for`, parenthesized groups — are hit hardest because the
interpreter re-seeks to re-read them.

The modern trigger is new. Batch files used to be written by Windows tools that
emitted CRLF without being asked. Now they are written by editors defaulting to LF
and by AI agents whose file-writing tools emit a bare line feed, so a script shape
that worked for twenty years arrives broken from a generator that never considered
the question.

## Workaround

Write `.cmd` and `.bat` files with CRLF, explicitly:

```js
const body = lines.join("\r\n") + "\r\n";
fs.writeFileSync("run.cmd", body);        // not join("\n")
```

Pin it in `.gitattributes` so a checkout cannot undo it:

```
*.cmd text eol=crlf
*.bat text eol=crlf
```

And scan for it, since the failure never names itself:

```powershell
Get-ChildItem -Filter *.cmd -Recurse | Where-Object {
  -not ([IO.File]::ReadAllBytes($_.FullName) -contains 13)
} | Select-Object FullName    # LF-only batch files
```

PowerShell scripts do not share this — `.ps1` files handle LF fine. It is
specifically the batch interpreter.

---

`bomless-bat-oem-codepage` is the other way a batch file can be byte-wrong: there
the encoding is misread, here the line terminator is. Both produce a
"not recognized" error naming something you never wrote, which is why the pair is
worth knowing together.
