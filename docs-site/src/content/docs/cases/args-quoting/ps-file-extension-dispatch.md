---
title: "powershell -File refuses scripts that aren't named .ps1"
description: "args-quoting landmine — hard-error (both)"
sidebar:
  label: "ps file extension dispatch"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#extension-dispatch">extension-dispatch</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">NOT A POWERSHELL SCRIPT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">extension dispatch</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">shell matching suffix</span></span></div></div>

# powershell -File refuses scripts that aren't named .ps1

## Symptom

A bootstrap downloads an installer script to a temp file and runs it with
`powershell -File $tmpfile`. On Windows it fails with "the file ... is not
recognized as a PowerShell script" — because the temp file was created with a
`.sh` (or extensionless) name by cross-platform code.

## Repro

```powershell
Copy-Item installer.ps1 installer.sh
powershell -File .\installer.sh
# Processing -File 'installer.sh' failed: the file does not have a '.ps1' extension.
```

## Cause

`powershell -File` / `pwsh -File` dispatch on the FILENAME EXTENSION, not the
content. Anything not ending in .ps1 is rejected before parsing. Cross-platform
download helpers that default temp suffixes to .sh silently arm this on the
Windows branch.

## Workaround

- Choose the temp suffix by target shell: `.ps1` when the launcher is
  PowerShell, `.sh` for POSIX. The referenced fix does exactly this
  (suffix = shell === 'powershell' ? 'ps1' : 'sh').

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/0efd755ed938e13bb527105fd83500ad1001d0e6>
- <https://github.com/lidge-jun/opencodex/commit/b63f5c80fa4bff17e8dc7ad7c8ed666faaf3d29e>
