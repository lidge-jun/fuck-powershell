---
title: "$? lies about native commands; check $LASTEXITCODE"
description: "exit-codes landmine — silent (both)"
sidebar:
  label: "exit code vs dollar q"
---

<p class="case-eyebrow">exit codes · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#exit-code-propagation">exit-code-propagation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">exit code propagation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">lastexitcode gate</span></span></div></div>

# $? lies about native commands; check $LASTEXITCODE

## Symptom

A pipeline keeps going after a native command failed. CI stays green while the
build inside it broke. Nothing threw, nothing stopped — the failure was simply
never observed.

## Repro

```powershell
git clone https://example.invalid/nope.git
if ($?) { "looks fine" }        # may print despite the failure in some shapes
"exit was: $LASTEXITCODE"       # 128 — the only honest signal
deploy-something                 # runs anyway
```

## Cause

PowerShell's error machinery (`$?`, try/catch, `$ErrorActionPreference`) is built
around cmdlets and ErrorRecords. Native commands communicate failure through exit
codes, which PowerShell before 7.4's `PSNativeCommandUseErrorActionPreference`
ignores by default. Even PowerShell's own tooling had this class of bug: the .NET
global tool wrapper failed to propagate the native return code until PR #10461
fixed it.

## Workaround

- After every native command that matters: `if ($LASTEXITCODE -ne 0) { throw ... }`.
- PowerShell 7.4+: set `$PSNativeCommandUseErrorActionPreference = $true`.
- In CI steps, prefer explicit exit-code checks over trusting the step to fail.

## Refs

- <https://github.com/PowerShell/PowerShell/pull/10461>
- <https://github.com/lidge-jun/ima2-gen/commit/1442bd1fa555ebda0db9b2a4a86f48ab504fd122>
