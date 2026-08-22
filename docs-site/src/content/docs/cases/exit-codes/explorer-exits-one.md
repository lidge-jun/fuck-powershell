---
title: "explorer.exe returns 1 on success — your spawn wrapper calls it failure"
description: "exit-codes landmine — misleading-error (both)"
---

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#exit-code-propagation">exit-code-propagation</a></div>

## Symptom

"Reveal in folder" works — Explorer opens with the file selected — but the app
logs an error every time, because execFileSync threw on a non-zero exit code.

## Repro

```js
execFileSync("explorer.exe", ["/select,", "C:\\file.txt"]);
// throws: exit code 1 — yet the window opened correctly
```

## Cause

explorer.exe exits 1 even on success (it hands off to the running shell process
and returns immediately). Exit-code-based success detection is structurally
wrong for this binary.

## Workaround

- Spawn detached, ignore the exit code, treat "spawn succeeded" as success
  (the referenced fire-and-forget fix).
- Generalize: for Windows shell-handoff binaries (explorer, start), never
  encode success as exit 0.

## Refs

- <https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8>
