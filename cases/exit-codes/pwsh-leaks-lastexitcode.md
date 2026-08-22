---
id: pwsh-leaks-lastexitcode
title: "A handled $LASTEXITCODE still fails your CI step"
category: exit-codes
versions: "7.x"
failure: misleading-error
context: [ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/d0b5989b7986c22e8539bf82544cfeb9bfebbe8c
---

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
