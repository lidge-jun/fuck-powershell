---
title: "irm | iex cannot pass parameters — your -Switch goes to iex, not the script"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "piped IEX drops params"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">interactive</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#iex-session">iex-session</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARAMETERBINDING</span></div><div class="row"><span class="k">Mechanism</span><span class="v">iex session</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">download then file</span></span></div></div>

# irm | iex cannot pass parameters — your -Switch goes to iex, not the script

## Symptom

Docs advertise `irm https://x/install.ps1 | iex -SomeOption` and users report
the option does nothing — or `iex` errors about an unknown parameter. The
streamed installer always runs with defaults.

## Repro

```powershell
irm https://example.com/install.ps1 | iex -BootstrapDependencies
# Invoke-Expression : A parameter cannot be found that matches parameter name
# 'BootstrapDependencies'. (iex has no such parameter — and no way to forward one)
```

## Cause

`Invoke-Expression` evaluates a STRING. It has no mechanism to bind parameters
into the script it evaluates; anything after `iex` is an argument to iex
itself. The pipe-to-iex distribution form structurally cannot accept options.

## Workaround

- Parameterized installs must download then invoke:
  `irm url -OutFile i.ps1; powershell -File i.ps1 -SomeOption` (mind
  execution-policy-file-block).
- Or read options from env vars inside the script (`$env:INSTALL_OPTS`), which
  survive the iex form. The referenced commit removed the misleading flagged
  one-liner and pinned a contract test that iex takes no installer parameters.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/0851921ae0b3ab382c2546b24e5aa67b0d163b37>
