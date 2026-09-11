---
title: "Joining PATH with ':' silently no-ops on Windows"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "PATH colon not delimiter"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#path-delimiter">path-delimiter</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">path delimiter</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">path win32 delimiter</span></span></div></div>

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

## Refs

- <https://github.com/lidge-jun/codexclaw/commit/23e2fee29e735a06246846aa2a26605a0022514b>
