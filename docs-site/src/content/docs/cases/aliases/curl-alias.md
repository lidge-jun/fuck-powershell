---
title: "curl silently becomes Invoke-WebRequest"
description: "aliases landmine — misleading-error (5.1)"
sidebar:
  label: "curl alias"
---

<p class="case-eyebrow">aliases · case</p>

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#alias-shadowing">alias-shadowing</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARAMETERBINDING</span></div><div class="row"><span class="k">Mechanism</span><span class="v">alias shadowing</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">curl exe</span></span></div></div>

## Symptom

A script or coding agent runs `curl -s -o out.json https://api.example.com` under
Windows PowerShell and gets a parameter-binding error, a prompt hanging on input, or
an HTML-ish object instead of a file. The error mentions `Invoke-WebRequest`
parameters, not curl — which sends you debugging the wrong tool.

## Repro

```powershell
# Windows PowerShell 5.1
Get-Command curl          # -> Alias  curl -> Invoke-WebRequest
curl -s https://example.com
# Invoke-WebRequest : Parameter cannot be processed because the parameter name 's'
# is ambiguous. Possible matches include: -SessionVariable -SkipCertificateCheck ...
```

Observed live: an AI agent driving a Slack integration issued `curl` for an API
round-trip; PowerShell resolved the alias, the flags bound to Invoke-WebRequest
parameters, and the call failed with an error that pointed nowhere near the cause.

## Cause

Windows PowerShell 5.1 ships `curl` and `wget` as built-in aliases for
`Invoke-WebRequest`. An upstream attempt to remove them (PR #1901) was closed
unmerged for compatibility; 5.1 keeps the aliases forever. PowerShell 7 removed
them on all platforms, so the same command behaves differently across versions.

## Workaround

- Call `curl.exe` explicitly — the `.exe` suffix bypasses alias resolution.
- Or use `Invoke-RestMethod`/`Invoke-WebRequest` with native parameters on purpose.
- Agent system prompts targeting Windows should ban bare `curl`/`wget`.

## Refs

- <https://github.com/PowerShell/PowerShell/pull/1901>
- <https://github.com/lidge-jun/opencodex/commit/760b287bc5287c8f631d6500b738fad53679e6e4>
