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
