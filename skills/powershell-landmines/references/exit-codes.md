
# A handled $LASTEXITCODE still fails your CI step

## Symptom

A `shell: pwsh` GitHub Actions step runs a native command whose non-zero exit is
EXPECTED (e.g. `schtasks /query` returning 1 because the task was already
deleted — which is success for an uninstall check). The script handles the code
correctly, prints the right message... and the step still fails red.

## Repro

```yaml
- shell: pwsh
  run: |
    schtasks /query /tn "gone-task" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "task removed - OK" }
    # step exits 1 anyway: the last native exit code leaks into the step result
```

## Cause

The pwsh process exit code defaults to the LAST native command's exit code when
the script ends without an explicit `exit`. Actions' `shell: pwsh` wrapper
surfaces that as step failure — even though your logic already consumed and
handled the value. This is distinct from exit-code-vs-dollar-q ($? lying): here
you READ `$LASTEXITCODE` correctly and it still leaks.

## Workaround

- End the script (or the expected-failure branch) with an explicit `exit 0`.
- Treat every `shell: pwsh` step whose last statement is a native command as
  suspect; make the final exit explicit.


---


# exit 1 inside irm | iex kills the user's terminal

## Symptom

A user runs the documented one-liner `irm https://example.com/install.ps1 | iex`.
The installer hits an error path with `exit 1` — and the user's ENTIRE
interactive PowerShell session closes. No error message survives; the window is
just gone.

## Repro

```powershell
# In an interactive session:
"exit 1" | iex        # your terminal closes.
# vs
powershell -File failing.ps1   # child exits 1; your session survives.
```

## Cause

`iex` runs the script text in the CURRENT session, so `exit` terminates the
caller's host — the interactive terminal for the copy-paste install flow. The
same script under `-File` gets its own process, where `exit N` is the correct
way to return a code. One script, two execution models, opposite semantics.

## Workaround

- Fail with `throw` (catchable, survivable under `iex`) instead of `exit`.
  Under `-File`, an uncaught throw still yields a non-zero exit code.
- The referenced fix replaced every error-path `exit 1` with a `throw` in a
  `Stop-Install` helper, keeping both distribution modes correct — and pinned
  it with a throw-vs-exit contract test suite.


---


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
