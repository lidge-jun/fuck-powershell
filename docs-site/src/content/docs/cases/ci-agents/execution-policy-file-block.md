---
title: "Execution policy blocks your downloaded installer — irm | iex is the workaround, not a style choice"
description: "ci-agents landmine — hard-error (5.1)"
---

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">interactive</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#execution-policy-gate">execution-policy-gate</a></div>

## Symptom

A user downloads `install.ps1` and runs it. Windows PowerShell refuses:
"running scripts is disabled on this system" (PSSecurityException,
UnauthorizedAccess). The same content pasted into the terminal runs fine —
confusing everyone.

## Repro

```powershell
# Default Windows PowerShell policy is Restricted (client SKUs):
powershell -File .\install.ps1
# File ... cannot be loaded because running scripts is disabled on this system.
```

## Cause

Execution policy gates SCRIPT FILES, not commands: `-File` and `.ps1` dispatch
are blocked under Restricted/AllSigned (and unsigned downloads under
RemoteSigned via Mark-of-the-Web), while in-memory text execution is not. That
asymmetry is why installer one-liners are `irm URL | iex` — piping text into
the session bypasses file policy. It is a distribution constraint, not slop.

## Workaround

- Distribute the documented entrypoint as `irm <url> | iex` (and then follow
  irm-iex-kills-host: the script must `throw`, never `exit`).
- For local runs, `powershell -ExecutionPolicy Bypass -File install.ps1`
  scopes the override to one process — do not change machine policy.
- CI runners set Bypass for `shell: powershell/pwsh` already; this trap bites
  end-user machines, not Actions.

## Refs

- <https://github.com/lidge-jun/ima2-gen/commit/1442bd1fa555ebda0db9b2a4a86f48ab504fd122>
