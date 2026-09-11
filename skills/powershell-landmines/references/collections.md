---
id: get-content-scalar-collapse
title: "a one-line file makes Get-Content return a String, so [0] gives a character and .Length counts characters"
category: collections
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/12
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-get-content]
  caused_by: [mechanism-collection-unrolling]
  mitigated_by: [workaround-array-force]
---

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


---

---
id: ne-filters-instead-of-compares
title: "-ne against a list is a FILTER, so a two-entry denylist silently allows the value it blocks"
category: collections
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/13
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-ne]
  caused_by: [mechanism-comparison-as-filter]
  mitigated_by: [workaround-contains-membership, workaround-array-force]
---

# -ne against a list is a FILTER, so a two-entry denylist silently allows the value it blocks

## Symptom

A denylist check passes the thing it was written to block.

## Repro

```powershell
$forbidden = @("admin", "root")
$user = "admin"

if ($forbidden -ne $user) { "ALLOWED" } else { "denied" }
# ALLOWED
```

The value is in the list. The comparison is spelled correctly. It still lets it
through, and nothing warns you.

## Cause

When the **left** operand is a collection, PowerShell's comparison operators are
not booleans — they are **filters**. They return the matching elements, and the
`if` then applies truthiness to whatever came back.

```powershell
$a = @("x","y","x")
$r = ($a -eq "x")
$r.GetType().Name    # Object[]     not Boolean
@($r).Count          # 2
$r -join ","         # x,x          the matches themselves

($a -ne "x") -join ","   # y         the NON-matches
```

So `$forbidden -ne "admin"` returns `@("root")` — a non-empty array — which is
truthy. The check is really asking *"are there any entries that are not admin?"*,
and the answer is yes.

## The size dependency is what makes it dangerous

```powershell
@("admin")        -ne "admin"   ->  empty  ->  falsy  ->  "denied"   correct
@("admin","root") -ne "admin"   ->  @("root") -> truthy -> "ALLOWED"  WRONG
@()               -ne "anything" -> empty  ->  falsy  ->  "denied"   correct
```

A denylist with **one** entry behaves correctly. Add a second entry and the
check inverts. That is the worst possible failure curve: it works in the unit
test, it works in the first deployment, and it breaks the day someone extends a
config list.

## Workaround

```powershell
if ($forbidden -contains $user) { "denied" } else { "allowed" }
# denied
```

Rules that hold up:

- Membership is `-contains` / `-notcontains` (collection on the left) or
  `-in` / `-notin` (collection on the right). Never `-eq` / `-ne`.
- If you genuinely want a boolean from a comparison, keep the collection off the
  left side, or wrap the result: `@($a -eq $x).Count -gt 0`.
- Be especially suspicious of `-ne` against any variable that *might* be a list.
  `-eq` at least fails toward "no match"; `-ne` fails toward "allowed".

## Related trap in the same family

`-contains` does **not** do substring matching, which is what the name suggests
to anyone arriving from another language:

```powershell
"hello" -contains "ell"        # False
"hello".Contains("ell")        # True
```

So the operator that sounds like substring search is membership, and the
operators that look like comparison are filters. Both surprises push in the
direction of an accidental pass.

---

Nothing in the archive covers collection-side comparison semantics. The nearest
entries use `-ne` only against scalars (`$LASTEXITCODE -ne 0`), where the
behaviour is the expected boolean.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11.


---

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
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, runtime-node, env-windows]
  invokes: [command-return, command-write-host, command-test-path, command-new-item]
  caused_by: [mechanism-host-vs-pipeline, mechanism-collection-unrolling]
  mitigated_by: [workaround-out-null, workaround-array-force]
  unsafe_fix: [workaround-gt-null]
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
