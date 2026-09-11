---
title: "PS 5.1 turns native stderr into NativeCommandError"
description: "streams landmine — misleading-error (5.1)"
sidebar:
  label: "native stderr errorrecord"
---

<p class="case-eyebrow">streams · case</p>

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#stream-wrapping">stream-wrapping</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">NATIVECOMMANDERROR</span></div><div class="row"><span class="k">Mechanism</span><span class="v">stream wrapping</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">continue eap</span></span></div></div>

# PS 5.1 turns native stderr into NativeCommandError

## Symptom

A native tool that merely writes progress to stderr (git, uv, npm, curl) appears to
FAIL under Windows PowerShell 5.1: red `NativeCommandError` text, or — with
`$ErrorActionPreference = 'Stop'` — the whole script terminates even though the
tool exited 0.

## Repro

```powershell
# Windows PowerShell 5.1, with strict error preference
$ErrorActionPreference = 'Stop'
uv python install 3.12 2>&1   # uv writes progress to stderr
# -> script terminates: uv's progress lines became ErrorRecord objects
```

## Cause

When 5.1 redirects a native command's stderr (`2>&1`, or captures in a variable),
each stderr line is wrapped in an `ErrorRecord` and surfaced through the error
stream. Combined with `$ErrorActionPreference='Stop'`, successful commands become
fatal errors. The hermes-agent installer hit this with uv and shipped a fix that
relaxes EAP around the native call and verifies success separately (see ref).
PowerShell 7.2+ no longer wraps native stderr this way.

## Workaround

- Do not combine `2>&1` with `Stop` preference around native commands on 5.1.
- Temporarily set `$ErrorActionPreference='Continue'` around the call, then check
  `$LASTEXITCODE`.
- The cli-jaw installer documents this exact hazard in its 5.1-safe install path.

## Refs

- <https://github.com/dqfront/NousResearch-hermes-agent/commit/ec1714e71f90691e1cf412796e9a4b4ba0d934f4>
- <https://github.com/lidge-jun/cli-jaw/commit/8c72d7568d0facf692b8adfa1429aa083c703ee3>
- <https://github.com/lidge-jun/cli-jaw/blob/main/scripts/install.ps1>
