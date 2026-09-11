---
title: "npm's .ps1 shim wins the PATH race and nothing can run it"
description: "aliases landmine — hard-error (both)"
sidebar:
  label: "NPM PS1 not comspec"
---

<p class="case-eyebrow">aliases · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pathext-resolution">pathext-resolution</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#execution-policy-gate">execution-policy-gate</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">PSSECURITYEXCEPTION</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pathext resolution, execution policy gate</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">get command</span></span></div></div>

# npm's .ps1 shim wins the PATH race and nothing can run it

## Symptom

Tool detection finds "npm" but every attempt to execute it fails: cmd.exe says
it can't run the file, spawn calls error out, or execution policy blocks it.
Meanwhile `npm.cmd` sits right next to it, working fine.

## Repro

```powershell
# npm installs THREE shims side by side: npm, npm.cmd, npm.ps1
Get-Command npm     # PowerShell may resolve npm.ps1 first
# cmd.exe /c npm.ps1  → not executable via ComSpec
# Restricted policy   → npm.ps1 blocked entirely
```

## Cause

npm ships `tool`, `tool.cmd`, and `tool.ps1` shims. `Get-Command` and PATHEXT
resolution can select the `.ps1`, which (a) execution policy may block, (b)
cmd.exe/ComSpec cannot execute, and (c) CreateProcess cannot launch directly.
The extensionless file is a POSIX sh script — equally unrunnable natively.

## Workaround

- Resolve explicitly in preference order `.exe` > `.cmd`, never `.ps1`:
  `Resolve-CommandPath @('npm.cmd','npm.exe','npm')` or
  `Get-Command npm -CommandType Application`.
- In spawn logic, treat `.ps1` as non-launchable (needs an interpreter);
  the referenced fix rejects it even when PATHEXT lists it.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/380e26346e1b90824937ee409c4ddf40c1d57102>
