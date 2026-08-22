---
id: explorer-exits-one
title: "explorer.exe returns 1 on success — your spawn wrapper calls it failure"
category: exit-codes
versions: "both"
failure: misleading-error
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0c20c014e4a9940f12a36d9e624e325e4d2fc2a8
ontology:
  affects: [runtime-node, env-windows]
  invokes: [command-explorer]
  manifests_as: [error-exit-code-leak]
  caused_by: [mechanism-exit-code-propagation]
  mitigated_by: [workaround-ignore-handoff-exit]
---

# explorer.exe returns 1 on success — your spawn wrapper calls it failure

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
