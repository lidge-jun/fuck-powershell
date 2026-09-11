---
title: "-WindowStyle Hidden still flashes a console window"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "-WindowStyle vs windowsHide"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#console-allocation">console-allocation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">console allocation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">create no window</span></span></div></div>

# -WindowStyle Hidden still flashes a console window

## Symptom

A background service launches `powershell.exe -WindowStyle Hidden -Command ...`
for a quick lookup, and users see a console window flash on screen anyway —
sometimes stealing focus mid-typing. The flag looks correct; the window appears
regardless.

## Repro

```powershell
# From a console-less parent (a GUI app or service):
powershell.exe -WindowStyle Hidden -Command "whoami"
# A new console window is allocated and briefly visible.
```

## Cause

`powershell.exe` is a console-subsystem binary. When its parent has no console,
Windows allocates a brand-new console at process creation — BEFORE PowerShell
ever parses `-WindowStyle Hidden`. The flag hides the window only after startup,
which is why it flashes. Suppression must happen at the Win32 level:
CREATE_NO_WINDOW (`windowsHide: true` in Node/Bun spawn options).

## Workaround

- Set `windowsHide: true` (CREATE_NO_WINDOW) in the spawning runtime; treat
  `-WindowStyle Hidden` as a cosmetic hint, not a suppression mechanism.
- The referenced production fix moved identity/CIM lookups to `windowsHide`
  after user-visible console flashes (#1236).

## Refs

- <https://github.com/lidge-jun/opencodex/commit/93a083d1fc0a28853dc3eb385bf55e16af9e5b7f>
- <https://github.com/lidge-jun/opencodex/commit/26dc5aa2b78bf902b8b27a122d6ada1bd2184906>
