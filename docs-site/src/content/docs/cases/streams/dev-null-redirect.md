---
title: "> /dev/null creates a literal file (or kills CI) on Windows"
description: "streams landmine — hard-error (both)"
sidebar:
  label: "dev null redirect"
---

<p class="case-eyebrow">streams · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#posix-dev-null">posix-dev-null</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">posix dev null</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">dollar null redirect</span></span></div></div>

## Symptom

A cross-platform script silences output with `> /dev/null 2>&1`. On Windows the
job fails outright, or a mysterious file named `dev` (or a `\dev\null` path error)
appears. Windows-only CI lanes go red while every POSIX lane stays green.

## Repro

```powershell
cmd-that-writes-stderr 2>/dev/null
# out-file : Could not find a part of the path 'C:\dev\null'
```

## Cause

`/dev/null` is a POSIX device path. PowerShell treats it as a relative file path
under the current drive; there is no `C:\dev\null`, so redirection either errors
or creates unexpected files. The robodog project hit exactly this class of bug and
shipped an auto-translation layer converting `2>nul` / `2>/dev/null` to `2>$null`
with regression tests (see ref).

## Workaround

- PowerShell-native: redirect to `$null` (`2>$null`, `*> $null`) or pipe to
  `Out-Null`.
- Cross-platform scripts: branch on platform, or use the runtime's null device
  abstraction instead of a hardcoded path.

## Refs

- <https://github.com/adourish/robodog/commit/ecdc052ffbb3cede9526ae7001d21acf8f8f7f8b>
