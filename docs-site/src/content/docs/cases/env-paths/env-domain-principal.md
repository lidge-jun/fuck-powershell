---
title: "$env:USERDOMAIN is not your identity"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "env domain principal"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#env-derived-identity">env-derived-identity</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">ACCOUNT SID MAPPING</span></div><div class="row"><span class="k">Mechanism</span><span class="v">env derived identity</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">sid principal</span></span></div></div>

# $env:USERDOMAIN is not your identity

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
