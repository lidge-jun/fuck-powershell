---
title: "PowerShell 5.1 has no && or || — agents loop on parser errors"
description: "versions landmine — hard-error (5.1)"
sidebar:
  label: "PS 5.1 no and and"
---

<p class="case-eyebrow">versions · case</p>

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">interactive</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pipeline-chain-ops">pipeline-chain-ops</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARSERERROR</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pipeline chain ops</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">lastexitcode gate</span></span></div></div>

# PowerShell 5.1 has no && or || — agents loop on parser errors

## Symptom

An AI agent (or a developer used to bash/pwsh 7) runs `build.cmd && deploy.cmd`
in Windows PowerShell 5.1 and gets "The token '&&' is not a valid statement
separator in this version." Agents told to "retry" replay the same line and loop
forever on the identical parser error.

## Repro

```powershell
# Windows PowerShell 5.1
echo a && echo b
# ParserError: The token '&&' is not a valid statement separator in this version.
# pwsh 7: works (pipeline-chain operators were added in PowerShell 7).
```

## Cause

Pipeline-chain operators `&&`/`||` shipped in PowerShell 7. 5.1 treats them as
parser errors. The trap compounds for agents: `;` is NOT a substitute (it runs
the next statement unconditionally, losing the failure gate), and bash habits
like `cd /d` or heredocs also die in PS.

## Workaround

- Gate conditionally: `command1; if ($?) { command2 }` — or check
  `$LASTEXITCODE` for native commands.
- Agent system prompts targeting Windows hosts must ban `&&`/`||` for 5.1 and
  map POSIX recovery commands (cat/ls/grep) to PS equivalents
  (Get-Content/Get-ChildItem/Select-String). The referenced fix ships exactly
  that guidance into an agent bridge.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/d44e5673529e25118f2dd4fef6f396b5612f140d>
