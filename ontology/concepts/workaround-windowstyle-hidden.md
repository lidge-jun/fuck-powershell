---
id: workaround-windowstyle-hidden
type: Workaround
label: "windowstyle hidden"
---

## Definition

Pass -WindowStyle Hidden to hide the console.

## Why it's unsafe

The console is allocated by Win32 BEFORE PowerShell parses the flag, so it still flashes; on Bun 1.3.14 the argv pair even breaks spawn. Use CREATE_NO_WINDOW (windowsHide).
