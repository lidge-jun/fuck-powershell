---
id: pathext-exe-beats-cmd
title: "A sibling .exe silently beats your .cmd shim — PATHEXT rank order"
category: env-paths
versions: "both"
failure: silent
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/1b626e4f8120d47ba40ded812ca300acb9ac1a94
---

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
