---
id: write-host-not-success-stream
title: "Write-Host output is invisible to 2>&1 | Out-String"
category: streams
versions: "both"
failure: silent
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/b46261a96eda8f51d91aa4eebd8483c564b41b2c
---

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
