---
title: "exit 1 inside irm | iex kills the user's terminal"
description: "exit-codes landmine — hard-error (both)"
sidebar:
  label: "IRM IEX kills host"
---

<p class="case-eyebrow">exit codes · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">interactive</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#iex-session">iex-session</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7</span></div><div class="row"><span class="k">Fails as</span><span class="v">TERMINAL KILLED</span></div><div class="row"><span class="k">Mechanism</span><span class="v">iex session</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">throw not exit</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/514f9a9cd0f3d40e37578fa641c33dec9aadff37>
- <https://github.com/lidge-jun/cli-jaw/commit/71dcfdd7a41f0b1d7b0bb489b883324d43eb6157>
