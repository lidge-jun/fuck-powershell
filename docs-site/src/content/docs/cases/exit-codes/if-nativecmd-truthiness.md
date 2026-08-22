---
title: "if (nativecmd) branches on whether it PRINTED, so a silent success is falsy and a noisy failure is truthy"
description: "exit-codes landmine — silent (both)"
---

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#output-truthiness">output-truthiness</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#collection-unrolling">collection-unrolling</a></div>

## Symptom

You write the thing every other shell taught you:

```powershell
if (mytool --check) { "ok" } else { "failed" }
```

It answers confidently and it is **backwards**. A tool that succeeded silently
reports failure; a tool that failed loudly reports success.

## Repro

```powershell
if (node -e "process.exit(0)") { "truthy" } else { "falsy" }
# falsy      <- succeeded, reported as failure

if (node -e "process.exit(1)") { "truthy" } else { "falsy" }
# falsy      <- failed; right answer, wrong reason

if (node -e "console.log('x'); process.exit(1)") { "truthy" } else { "falsy" }
# truthy     <- FAILED, reported as success
```

Full truth table, with `$LASTEXITCODE` shown for contrast:

| tool behaviour | exit | `if (...)` says | correct? |
|---|---|---|---|
| silent, succeeds | 0 | falsy | **no** |
| silent, fails | 1 | falsy | by accident |
| prints output, fails | 1 | **truthy** | **no** |
| prints output, succeeds | 0 | truthy | by accident |

The condition tracks **whether the command printed anything**, not whether it
worked.

## Cause

A native command in a PowerShell expression evaluates to its captured *output*,
not its exit status. The `if` then applies normal truthiness to that value: an
empty result is false, a non-empty string or array is true. Exit codes never
enter the expression.

This is worse than a missing feature, because the failure correlates with
verbosity. Quiet, well-behaved tools — the ones that print nothing on success —
are precisely the ones this always gets wrong.

### A related surprise in the same area

The captured value's **type changes with the number of output lines**:

```powershell
$o = node -e "console.log('one')"
$o.GetType().Name           # String

$o = node -e "console.log('a'); console.log('b')"
$o.GetType().Name           # Object[]
$o.Length                   # 2
```

So `$o -eq "expected"`, `$o.Trim()` and `$o.Length` all mean different things
depending on how much the tool decided to say. A one-line log message turns a
working comparison into an array membership test.

## Workaround

```powershell
node -e "process.exit(1)"
if ($LASTEXITCODE -eq 0) { "ok" } else { "failed with $LASTEXITCODE" }
# failed with 1
```

Run the command as a **statement**, then branch on `$LASTEXITCODE` on the next
line. Never put a native command inside `if (...)`, `while (...)`, `-and` or
`-or`. When you need the output too, capture it separately and force an array
with `@(...)` so the type stops depending on line count.

---

`exit-code-vs-dollar-q` covers `$?` lying about native commands and prescribes
`$LASTEXITCODE`. This case is the shape people actually write — the native
command placed *directly* in the condition — where `$?` is never consulted at
all and the branch is decided by output volume. The output-type-changes-with-
line-count behaviour is not recorded anywhere in the archive either.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/11>
