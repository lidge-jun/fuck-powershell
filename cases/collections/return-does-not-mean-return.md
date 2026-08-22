---
id: return-does-not-mean-return
title: "return does not mean return - a side-effect cmdlet silently makes your function hand back two values"
category: collections
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/14
---

# return does not mean return - a side-effect cmdlet silently makes your function hand back two values

## Symptom

A function with a single, explicit `return` gives back **two** values, and the
extra one is the output of a cmdlet you called for its side effect.

## Repro

```powershell
function Get-WorkDir {
    New-Item -ItemType Directory -Path "$env:TEMP\wd" -Force
    return "$env:TEMP\wd"
}

$d = Get-WorkDir
$d.GetType().Name     # Object[]     you asked for a path
@($d).Count           # 2
```

The damage shows up somewhere else entirely:

```powershell
"path is: $d"
# path is: C:\...\Temp\wd C:\...\Temp\wd     <- printed twice

node argv.mjs $d
# argc=2                                       <- passed as TWO arguments
```

Meanwhile `Test-Path $d` returns `True` — twice — so the sanity check you added
to catch this actually confirms the broken value.

## Cause

In PowerShell, `return` does not mean "return this value". Every expression that
produces output contributes to the function's result, and `return` only sets the
exit point. `New-Item` emits a `DirectoryInfo`, so the function's real result is
`@(DirectoryInfo, String)`.

```powershell
function f { "side effect"; return 42 }
@(f).Count           # 2
(f) -join "|"        # side effect|42
```

The pipeline unrolls a single result, so a function whose side-effect cmdlet
happens to be quiet returns a clean `String` — and the same function returns an
`Object[]` the day it starts creating something. The type depends on the code
path taken, not on the signature.

`Write-Host` is the exception that misleads people: it writes to the host, not
the output stream, so it does *not* pollute. `Write-Output` does.

```powershell
function g { Write-Host "log"; return 7 }       # $r -> 7          clean
function h { Write-Output "extra"; 99 }         # @($r) -> extra|99
```

## Workaround

Suppress every side-effect cmdlet explicitly:

```powershell
function Get-WorkDir {
    New-Item -ItemType Directory -Path "$env:TEMP\wd" -Force | Out-Null
    return "$env:TEMP\wd"
}
$d = Get-WorkDir
$d.GetType().Name    # String
node argv.mjs $d     # argc=1
```

`| Out-Null` is the portable form. `$null = ...` and `[void](...)` also work.
Do not rely on `> $null` here — see the `dev-null-redirect` case.

Defensive habit: when a caller needs a scalar, take one deliberately —
`$d = @(Get-WorkDir)[-1]` — rather than trusting the callee to have been careful.

## Why this is worth its own entry

The archive documents `Out-Null` only as a `/dev/null` replacement in
`dev-null-redirect`. Nothing covers accidental output pollution from function
bodies, which is the reason most scripts need `Out-Null` in the first place.

The failure mode is also unusually indirect: the function looks correct, the
assignment looks correct, `Test-Path` agrees, and the corruption only surfaces
when the value reaches a native command or a string interpolation — often a
different file, written by a different person.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.
