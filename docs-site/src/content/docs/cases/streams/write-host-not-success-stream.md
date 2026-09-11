---
title: "Write-Host output is invisible to 2>&1 | Out-String"
description: "streams landmine — silent (both)"
sidebar:
  label: "write host not success stream"
---

<p class="case-eyebrow">streams · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#host-vs-pipeline">host-vs-pipeline</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">host vs pipeline</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">write output</span></span></div></div>

# Write-Host output is invisible to 2>&1 | Out-String

## Symptom

A test captures "everything" with 2>&1 | Out-String — and the capture is EMPTY,
though the script clearly prints when run interactively. Assertions fail
against a blank string.

## Repro

```powershell
$out = & { Write-Host "important message" } 2>&1 | Out-String
$out.Length    # 0 — the message went to the host, not the pipeline
```

## Cause

Write-Host writes to the HOST, not the success stream. 2>&1 merges stderr only;
the message never enters the captured pipeline. In-process capture of host
output needs a different observer entirely.

## Workaround

- Script authors: Write-Output for capturable content; Write-Host only for
  human-only chrome.
- Test authors: 6>&1 merges the information stream, or wrap the run in
  Start-Transcript / Stop-Transcript (the referenced fix) to observe host
  output reliably.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/b46261a96eda8f51d91aa4eebd8483c564b41b2c>
