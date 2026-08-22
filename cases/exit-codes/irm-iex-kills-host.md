---
id: irm-iex-kills-host
title: "exit 1 inside irm | iex kills the user's terminal"
category: exit-codes
versions: "both"
failure: hard-error
context: [interactive, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/514f9a9cd0f3d40e37578fa641c33dec9aadff37
  - https://github.com/lidge-jun/cli-jaw/commit/71dcfdd7a41f0b1d7b0bb489b883324d43eb6157
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
