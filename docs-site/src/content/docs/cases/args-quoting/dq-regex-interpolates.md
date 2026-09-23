---
title: "Double-quoted regex interpolates $vars — and backslash won't save you"
description: "args-quoting landmine — misleading-error (both)"
sidebar:
  label: "dq regex interpolates"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#string-interpolation">string-interpolation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">UNSET VARIABLE</span></div><div class="row"><span class="k">Mechanism</span><span class="v">string interpolation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">single quote regex</span></span></div></div>

## Symptom

A test asserts against a regex like `"SetEnvironmentVariable\(\$entries..."` in a
double-quoted string. Under `Set-StrictMode` it explodes with "variable
'\$entries' cannot be retrieved" — or worse, without StrictMode it silently
matches garbage because \$entries expanded to nothing.

## Repro

```powershell
Set-StrictMode -Version Latest
$text -match "pattern(\$entries -join)"
# ERROR: The variable '$entries' cannot be retrieved because it has not been set.
# The backslash did NOT escape the dollar — \ is not an escape char in PowerShell.
```

## Cause

Two habits from other languages collide: PowerShell interpolates `$var` inside
DOUBLE-quoted strings, and its escape character is the backtick — backslash has
no escaping power. A regex written for .NET/PCRE with `\$` still interpolates.
The variable expands at string-construction time, before the regex engine sees
anything.

## Workaround

- Write regexes that mention `$` in SINGLE quotes: `'pattern(\$entries)'` —
  no interpolation, backslash reaches the regex engine intact.
- If double quotes are unavoidable, escape with backtick: `"\`$entries"`.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/3d198e2b80ddb13d02ce63b65e5c88a25b428009>
