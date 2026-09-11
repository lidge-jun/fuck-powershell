---
title: "a batch file saved with Unix line endings makes cmd.exe eat the first byte of lines, so npm becomes pm and powershell becomes hell"
description: "encoding landmine — misleading-error (both)"
sidebar:
  label: "CMD lf drops first byte"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#crlf-residue">crlf-residue</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">COMMAND NOT RECOGNIZED</span></div><div class="row"><span class="k">Mechanism</span><span class="v">crlf residue</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">write bat crlf</span></span></div></div>

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

The failure needs `goto` or `call` — a straight-line script usually survives LF.
Build one whose label sits far enough into the file to cross a 512-byte read
boundary:

```powershell
PS> $pad  = ":: " + ("x" * 600)
PS> $body = "@echo off", "goto :main", $pad, ":main", "npm --version"
PS> [IO.File]::WriteAllText("t.cmd", ($body -join [char]10) + [char]10)
PS> Format-Hex t.cmd | Select-String "0D 0A"    # nothing: the file is LF-only
PS> cmd /c t.cmd
```

Rewriting the identical text with CRLF makes it behave:

```powershell
PS> [IO.File]::WriteAllText("t.cmd", ($body -join "\r\n") + "\r\n")
PS> cmd /c t.cmd     # runs
```

What you get from the LF version varies with where the label lands: a label that
is not found, a block that silently does not execute, or a truncated token
reported as a missing command. `npm.cmd` itself uses `goto`, which is why the
reported symptoms name npm.

## Cause

cmd.exe reads a batch file in chunks as it executes rather than parsing it whole,
and it re-seeks whenever control moves — which is exactly what `goto` and `call`
do. The label scanner that performs that seek assumes a two-byte terminator, so on
an LF-only file its arithmetic drifts by one byte per line, and a label that
happens to sit near a chunk boundary is read at the wrong offset.

Straight-line execution mostly tolerates LF, which is why "it worked when I tried
it" is such a common and misleading data point. The failure lives in the seek
path, so it needs a script that jumps — and it appears or disappears when you add
a line anywhere above the label, because that moves where the boundary falls.

That positional sensitivity is what produces the truncated-token symptoms:
resuming at the wrong offset can start mid-word, so `call npm ...` is reported as
`'pm'` and `powershell` as `'hell'`. Nothing announces a line-ending problem.

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
specifically the batch interpreter's chunked read and label seek.

## Verification note

The originating report (openclaw#119484) is a user account with the symptoms and
a `Format-Hex` confirmation that the file was LF-only, not an executed
reproduction of the mechanism. The chunk-boundary label-scanner explanation comes
from published analyses of cmd.exe's batch reader rather than from a run in this
loop; this corpus has no Windows host, hence `repro: historical`. What is solidly
established is the remedy: batch files want CRLF, and the symptoms disappear when
they get it.

---

`bomless-bat-oem-codepage` is the other way a batch file can be byte-wrong: there
the encoding is misread, here the line terminator is. Both produce a
"not recognized" error naming something you never wrote, which is why the pair is
worth knowing together.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/49>
- <https://github.com/openclaw/openclaw/issues/119484>
