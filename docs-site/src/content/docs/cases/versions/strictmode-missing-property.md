---
title: "Set-StrictMode turns missing JSON fields into crashes"
description: "versions landmine — hard-error (both)"
sidebar:
  label: "strictmode missing property"
---

<p class="case-eyebrow">versions · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#strictmode-contract">strictmode-contract</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7</span></div><div class="row"><span class="k">Fails as</span><span class="v">PROPERTYNOTFOUND</span></div><div class="row"><span class="k">Mechanism</span><span class="v">strictmode contract</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">psobject probe</span></span></div></div>

## Symptom

A script parses a JSON manifest and reads optional fields (`$entry.tag`,
`$entry.artifacts.$arch`). It works for months — then dies with
PropertyNotFoundException the first time a manifest omits an optional field,
because the script also sets `Set-StrictMode -Version Latest`.

## Repro

```powershell
Set-StrictMode -Version Latest
$entry = '{"name":"x"}' | ConvertFrom-Json
$entry.tag
# PropertyNotFoundException — without StrictMode this quietly yields $null
```

## Cause

StrictMode changes the CONTRACT of property access: missing note-properties go
from "$null" to "throw". Optional-field patterns written under default mode
become latent crashes when someone adds StrictMode later (usually to catch the
dq-regex class of bug — the two traps travel together).

## Workaround

```powershell
if ($entry.PSObject.Properties.Name -contains 'tag') { $entry.tag }
```

Probe `PSObject.Properties.Name` before dereferencing optional fields; the
referenced fix wraps every optional manifest access this way.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/5fe703a73b78eab4a0e0bff1b9c0368d0d6018ad>
