
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
