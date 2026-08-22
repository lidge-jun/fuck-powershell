---
title: "$env:USERDOMAIN is not your identity"
description: "env-paths landmine — hard-error (both)"
---

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span></div>

## Symptom

An ACL/permissions script builds a principal as `"$env:USERDOMAIN\$env:USERNAME"`
and passes it to `icacls`. It works on the dev machine, then fails on a renamed
computer, a Microsoft-account login, or an AzureAD-joined machine: icacls cannot
resolve the principal, the grant fails, and if the code fails closed, the whole
feature dies.

## Repro

```powershell
# On a workgroup (non-domain) machine:
$env:USERDOMAIN          # -> COMPUTERNAME, not a domain
# Microsoft-account login: local profile name != account name
icacls secret.txt /grant "$env:USERDOMAIN\$env:USERNAME:(R)"
# -> "No mapping between account names and security IDs was done."
```

## Cause

`USERDOMAIN` is always set — on a workgroup machine it silently holds the computer
name, so `domain ? "domain\user" : user` fallbacks never fire. Both variables are
also plain environment values, writable by whatever launched the process, which
makes them attacker-influenceable in a permissions path.

## Workaround

Use the SID, which is what the token actually carries and which icacls accepts
directly:

```powershell
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls secret.txt /grant "*${sid}:(R)"
```

The referenced production fix replaced the env-derived principal with the current
token's SID for exactly the failure modes above.

## Refs

- <https://github.com/lidge-jun/opencodex/blob/main/src/lib/windows-secret-acl.ts>
