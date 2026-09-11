---
title: "a one-line file makes Get-Content return a String, so [0] gives a character and .Length counts characters"
description: "collections landmine — silent (both)"
sidebar:
  label: "get content scalar collapse"
---

<p class="case-eyebrow">collections · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#collection-unrolling">collection-unrolling</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">collection unrolling</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">array force</span></span></div></div>

# a one-line file makes Get-Content return a String, so [0] gives a character and .Length counts characters

## Symptom

Code that reads a file and inspects it works perfectly, ships, and then produces
nonsense the day the file happens to contain **one** line. No error — the same
expression simply means something different.

```powershell
$c = Get-Content log.txt
$c[0]        # two-line file -> "hello"      (first LINE)
             # one-line file -> "h"          (first CHARACTER)
$c.Length    # two-line file -> 2            (line count)
             # one-line file -> 5            (character count)
```

A line-counting script silently becomes a character-counting script.

## Repro

```powershell
[IO.File]::WriteAllText("$env:TEMP\one.txt", "hello")
[IO.File]::WriteAllText("$env:TEMP\two.txt", "hello`nworld")

(Get-Content $env:TEMP\one.txt).GetType().Name   # String
(Get-Content $env:TEMP\two.txt).GetType().Name   # Object[]

$a = Get-Content $env:TEMP\one.txt
$b = Get-Content $env:TEMP\two.txt
"$($a[0]) vs $($b[0])"                           # h vs hello
"$($a.Length) vs $($b.Length)"                   # 5 vs 2
```

And the empty case is a third shape again:

```powershell
[IO.File]::WriteAllText("$env:TEMP\zero.txt", "")
$c = Get-Content $env:TEMP\zero.txt
$null -eq $c        # True     <- not an empty array, actually null
@($c).Count         # 0
```

## Cause

PowerShell **unrolls** collections in the pipeline. A cmdlet returning one object
returns that object, not a one-element array; returning zero objects yields
`$null`. So the return type of `Get-Content` depends on the *contents of the
file*, and `String` happens to support `[0]` and `.Length` with entirely
different semantics from `Object[]`.

That coincidence is what makes it silent. If `String` lacked those members you
would get a clean "method not found"; instead both types answer, and only one is
the answer you meant.

`.Count` is safer than `.Length` — it returned 1 and 2 correctly here — but it
is a PowerShell-added property, not something a reader can rely on seeing in
ported code.

This affects every unrolling cmdlet the same way: `Get-ChildItem`,
`Select-String`, `Import-Csv`, and native command capture. A directory with one
file, a grep with one hit, a tool that logs one line — all the same trap.

## Workaround

```powershell
$c = @(Get-Content log.txt)     # always an array, even for 0 or 1 lines
$c.Count                        # 1
$c[0]                           # "hello"
```

Wrap **every** collection-producing call in `@(...)` at the point of assignment.
Use `-Raw` when you actually want one string:

```powershell
(Get-Content log.txt -Raw).GetType().Name    # String, deliberately
```

---

The archive mentions `Get-Content` only in passing, inside
`ps51-no-and-and`, and nothing covers single-element unrolling. This is
arguably the most-hit PowerShell landmine in scripts ported from bash, because it
is invisible until the data changes shape — the code is never edited, the file is.

Related but distinct from the observation in the `if (nativecmd)` report that
captured command output is a `String` at one line and `Object[]` at two: that is
the same unrolling rule seen from the native-command side. This case documents
the rule itself and the `[0]`/`.Length` semantic collision that makes it silent.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/12>
