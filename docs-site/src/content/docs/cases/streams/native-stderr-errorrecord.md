---
title: "PS 5.1 turns native stderr into NativeCommandError"
description: "streams landmine — misleading-error (5.1)"
---

| category | versions | failure | context | source | repro |
|---|---|---|---|---|---|
| streams | 5.1 | misleading-error | script, ci | third-party | verified |

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
- <https://github.com/lidge-jun/cli-jaw/blob/main/scripts/install.ps1>
