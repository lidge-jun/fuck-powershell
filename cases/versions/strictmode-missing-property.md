---
id: strictmode-missing-property
title: "Set-StrictMode turns missing JSON fields into crashes"
category: versions
versions: "both"
failure: hard-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/5fe703a73b78eab4a0e0bff1b9c0368d0d6018ad
---

# Set-StrictMode turns missing JSON fields into crashes

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
