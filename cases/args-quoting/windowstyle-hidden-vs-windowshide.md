---
id: windowstyle-hidden-vs-windowshide
title: "-WindowStyle Hidden still flashes a console window"
category: args-quoting
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/93a083d1fc0a28853dc3eb385bf55e16af9e5b7f
---

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
