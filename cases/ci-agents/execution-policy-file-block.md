---
id: execution-policy-file-block
title: "Execution policy blocks your downloaded installer — irm | iex is the workaround, not a style choice"
category: ci-agents
versions: "5.1"
failure: hard-error
context: [interactive, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/ima2-gen/commit/1442bd1fa555ebda0db9b2a4a86f48ab504fd122
---

# Execution policy blocks your downloaded installer

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
