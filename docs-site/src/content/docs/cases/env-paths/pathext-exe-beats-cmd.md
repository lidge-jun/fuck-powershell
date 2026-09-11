---
title: "A sibling .exe silently beats your .cmd shim — PATHEXT rank order"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "PATHEXT exe beats CMD"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pathext-resolution">pathext-resolution</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pathext resolution</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">shim all siblings</span></span></div></div>

# A sibling .exe silently beats your .cmd shim — PATHEXT rank order

## Symptom

A wrapper that rewrites `tool.cmd` works for months. Then an updater drops
`tool.exe` in the SAME directory and every invocation silently bypasses the
wrapper — no error, just the unwrapped binary running.

## Repro

```powershell
$env:PATHEXT   # .COM;.EXE;.BAT;.CMD;...  ← .EXE outranks .CMD
# dir with both tool.exe and tool.cmd → "tool" resolves to tool.exe, always.
```

## Cause

PATHEXT is an ordered list. Extensionless resolution tries `.COM`, then
`.EXE`, then `.BAT`/`.CMD` — within the same PATH entry. A shim strategy that
only owns the `.cmd` name is one updater run away from being invisible.

## Workaround

- Shim ALL launchable siblings (or rename/refresh the `.exe` too, as the
  referenced fix does).
- Detection: after installing a shim, resolve the bare name again and verify it
  lands on your shim.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/1b626e4f8120d47ba40ded812ca300acb9ac1a94>
