---
id: path-colon-not-delimiter
title: "Joining PATH with ':' silently no-ops on Windows"
category: env-paths
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/codexclaw/commit/23e2fee29e735a06246846aa2a26605a0022514b
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, env-windows]
  caused_by: [mechanism-path-delimiter]
  mitigated_by: [workaround-path-win32-delimiter]
---

# Joining PATH with ':' silently no-ops on Windows

## Symptom

A test or script prepends a directory to PATH with a colon:
PATH = binDir + ":" + oldPath. On Windows the tool in binDir is never found —
no error, the entry just does not participate in resolution.

## Repro

```js
process.env.PATH = binDir + ":" + process.env.PATH;   // POSIX habit
// Windows PATH is ;-separated: the whole thing becomes ONE bogus entry
// "C:\\bin:C:\\Windows\\system32;..." — binDir is unfindable.
```

## Cause

Windows separates PATH entries with semicolons; colons appear INSIDE entries as
drive designators (C:). A colon-joined PATH fuses your new directory with the
first original entry into one nonexistent path. The same bug appears in
PowerShell as \$env:Path = "\$bin:\$env:Path".

## Workaround

- Use the platform delimiter: Node path.delimiter (the referenced fix), or
  [IO.Path]::PathSeparator in PowerShell.
- Sibling traps: splitting on ':' shreds C:\\ entries (node-path-host-
  delimiter) and duplicate Path/PATH casings fight each other
  (env-path-vs-PATH-casing).
