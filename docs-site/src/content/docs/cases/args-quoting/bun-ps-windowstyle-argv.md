---
title: "Bun rejects powershell.exe argv containing -WindowStyle Hidden"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "bun ps windowstyle argv"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#bun-windowstyle-argv-reject">bun-windowstyle-argv-reject</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">bun, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">bun windowstyle argv reject</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">create no window</span></span></div></div>

## Symptom

PowerShell-based SID/process lookups and cleanup routines silently do nothing
under Bun on Windows. No error surfaces in the happy path; the spawn itself
failed before `-Command` ever ran.

## Repro

```js
// Bun 1.3.14, Windows
Bun.spawn(["powershell.exe", "-WindowStyle", "Hidden", "-Command", "whoami"]);
// spawn fails before PowerShell runs (#1589) — remove the -WindowStyle pair:
Bun.spawn(["powershell.exe", "-Command", "whoami"], { windowsHide: true }); // works
```

## Cause

A Bun 1.3.14 Windows spawn bug: the adjacent `"-WindowStyle", "Hidden"` argv
pair to `powershell.exe` makes process creation itself fail. Combined with the
flag being useless for console suppression anyway (see
windowstyle-hidden-vs-windowshide), keeping it in argv is all cost, no benefit.

## Workaround

- Strip `-WindowStyle Hidden` from every direct PowerShell argv; rely on
  `windowsHide: true` (CREATE_NO_WINDOW).
- Script-internal `Start-Process -WindowStyle Hidden` is a different construct
  and remains fine.
- The fix added a sweep test forbidding the argv pair across the codebase.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/0a904776160ea2954fbad1276b112f2c06ddfbae>
- <https://github.com/lidge-jun/opencodex/commit/393d72a779e92b3116b854d714916704756d8110>
