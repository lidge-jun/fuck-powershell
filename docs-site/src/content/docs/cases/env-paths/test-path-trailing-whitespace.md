---
title: "Test-Path says True for a path with trailing whitespace that Node cannot open"
description: "env-paths landmine — misleading-error (both)"
sidebar:
  label: "test PATH trailing whitespace"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#win32-path-normalization">win32-path-normalization</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">win32 path normalization</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">trim path</span></span></div></div>

## Symptom

A path passes validation in PowerShell and then does not exist for the tool you
hand it to. Same string, same machine, same moment.

```
PowerShell Test-Path:   True
PowerShell Get-Content: data
node existsSync:        false
```

Because PowerShell *reads the file successfully*, the validation step you added
to catch bad paths is the thing that certifies the broken one.

## Repro

A path carrying trailing whitespace, the way real data does — read from a
manifest, a CSV column, a tool's stdout:

```powershell
[IO.File]::WriteAllText("$env:TEMP\real.txt", "data")
[IO.File]::WriteAllText("$env:TEMP\list.txt", "$env:TEMP\real.txt ")   # note the space

$p = Get-Content "$env:TEMP\list.txt"
$p.Length                      # 43
[int][char]$p[-1]              # 32   <- a real space, still attached

Test-Path $p                   # True
Get-Content $p                 # data

node -e "console.log(require('fs').existsSync(process.argv[1]))" $p
# false
```

A trailing dot behaves the same way:

```powershell
Test-Path "$env:TEMP\real.txt."   # True
```

## Cause

Win32 path normalization strips trailing spaces and dots before the filesystem
call, so `"file.txt "` and `"file.txt."` both resolve to `file.txt`. PowerShell's
providers go through that normalization; `Test-Path` and `Get-Content` therefore
succeed.

Runtimes that pass the string closer to the raw API — Node's `fs`, and many
cross-platform toolchains that treat the path as an opaque byte string — do not
get that courtesy, and correctly report that no such file exists.

So the disagreement is not a bug in either one. It is two different definitions
of what the path *is*, and PowerShell's definition is the more forgiving one,
which is exactly why it hides the problem instead of surfacing it.

## Why this shape happens constantly

The trailing character almost never comes from a human typing it. It arrives from:

- a manifest or config line with an accidental space before the newline
- a CSV column that was padded
- a tool's stdout captured without trimming
- a here-string or template where the path sits before a line break

In every one of those, PowerShell validates it, and the failure lands in the
consumer — often a different process, a different language, and a stack trace
that says the file does not exist while you are staring at proof that it does.

## Workaround

```powershell
$p = (Get-Content "$env:TEMP\list.txt").Trim()
node -e "console.log(require('fs').existsSync(process.argv[1]))" $p
# true
```

Trim every path that came from data rather than from a literal, at the boundary
where it enters your script. And do not trust `Test-Path` as a cross-tool
contract — it answers for PowerShell's normalization rules, not for the consumer's.

When a path must survive a handoff, normalize it explicitly:

```powershell
$p = [IO.Path]::GetFullPath($p.Trim())
```

---

Nothing in the archive covers path normalization differences. The nearest
neighbours (`session-path-stale`, `envpath-pollutes-user`) are about `PATH`
the environment variable, not about a filesystem path validating in one runtime
and vanishing in the next.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/16>
