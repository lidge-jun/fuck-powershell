---
title: "a batch file with a non-ASCII path dies with 9009, and adding a BOM to fix it fuses onto the first line and kills it differently"
description: "encoding landmine — misleading-error (both)"
sidebar:
  label: "bomless bat oem codepage"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#default-encoding">default-encoding</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">cmd, windows, korean codepage</span></div><div class="row"><span class="k">Fails as</span><span class="v">COMMAND NOT RECOGNIZED, MOJIBAKE</span></div><div class="row"><span class="k">Mechanism</span><span class="v">default encoding</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">chcp first line</span></span></div></div>

# a batch file with a non-ASCII path dies with 9009, and adding a BOM to fix it fuses onto the first line and kills it differently

## Symptom

You generate a `.cmd` wrapper — an autostart shim, a service launcher, a
scheduled-task entry — and it works on your machine and fails on someone else's.
The exit code is `9009`, which cmd.exe means as "command not recognized", so you
go hunting for a missing binary that is right there on disk.

The actual difference is that their user name, or their install directory, is not
ASCII. Every path in the file that contains a Korean, Japanese, or accented
character arrives at cmd.exe as mojibake, and the path it tries to run does not
exist.

Then you fix the encoding the obvious way, save the file as UTF-8 with a BOM, and
it breaks again — differently.

## Repro

Write a wrapper containing a non-ASCII path and run it from a console whose OEM
codepage is not UTF-8 (the default on most non-English Windows installs):

```
PS> $body = "@ECHO OFF`r`nECHO C:\Users\정준\app`r`n"
PS> [IO.File]::WriteAllText("t.cmd", $body, [Text.UTF8Encoding]::new($false))
PS> cmd /c t.cmd
C:\Users\ъ á\app
```

Now save it WITH a BOM and watch the failure move:

```
PS> [IO.File]::WriteAllText("t.cmd", $body, [Text.UTF8Encoding]::new($true))
PS> cmd /c t.cmd
'∩╗┐@ECHO' is not recognized as an internal or external command,
operable program or batch file.
```

The exact garbage in front of `@ECHO` is whatever your console codepage makes of
the three BOM bytes `EF BB BF` — `∩╗┐` on a 437 or 850 console, something else on
949 or 932. The shape is the same everywhere: the BOM became characters, they
fused onto the first token, and cmd.exe went looking for a command by that name.

## Cause

cmd.exe reads a BOM-less batch file in the console's OEM codepage — 437 or 850 on
Western installs, 949 on Korean, 932 on Japanese — not in UTF-8. Bytes you wrote
as UTF-8 are decoded as something else, and any non-ASCII path becomes a different
path. Which mojibake you get depends on the console, which is why the same file
"works" for you and not for the next person.

A BOM does not opt you into UTF-8. cmd.exe has no BOM handling for batch files, so
the three BOM bytes are simply the first three characters of the first line. They
fuse onto whatever follows — `@ECHO OFF` becomes `∩╗┐@ECHO OFF` — and the
interpreter reports a command it cannot find. Same 9009, new reason.

This is what makes it expensive to diagnose: both spellings fail with the error
that means "your program is missing", and neither mentions encoding.

## Workaround

Write the file BOM-less and switch the codepage before any line that carries
non-ASCII text:

```bat
@ECHO OFF
chcp 65001 >nul
REM every line below is read as UTF-8
```

Put `chcp` first, above comments as well as commands. Keeping the whole preamble
ASCII costs nothing, and it removes the question of exactly when each line is
decoded — a detail that is easy to get wrong and hard to verify.

The alternative, when you control the content, is to keep the file pure ASCII —
resolve paths at runtime through `%LOCALAPPDATA%` and friends instead of baking
them in as literals.

---

`bom-less-ps1-cp949` is the PowerShell half of this: a `.ps1` without a BOM gets
read in the ANSI codepage. This is the cmd.exe half, and the fix is inverted — a
BOM helps PowerShell 5.1 and actively breaks a batch file.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/22>
- <https://github.com/lidge-jun/cli-jaw/commit/955d2b3f7bbac00874a73a07d130bc09bcf0ec93>
