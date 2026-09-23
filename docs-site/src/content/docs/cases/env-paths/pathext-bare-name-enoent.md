---
title: "An extensionless shim on PATH is invisible to Windows spawn — ENOENT with the file right there"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "PATHEXT bare name ENOENT"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pathext-resolution">pathext-resolution</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pathext resolution</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">pathext extension shim</span></span></div></div>

## Symptom

A test fixture (or dotfiles setup) drops an extensionless shebang script named
`codex` into a PATH directory — the POSIX way. Windows spawn returns ENOENT.
The file exists, is on PATH, and chmod 755 "succeeded" (a no-op on NTFS).

## Repro

```js
// binDir/codex  (#!/bin/sh script, no extension), binDir on PATH:
spawnSync("codex");        // ENOENT — never a candidate
```

## Cause

CreateProcess/PATHEXT resolution only tries the extensions in PATHEXT
(.COM;.EXE;.BAT;.CMD;...). An extensionless file is not in the candidate set at
all — there is no execute bit to save it, because NTFS ignores POSIX modes.
Distinct from npm-ps1-not-comspec (a WRONG shim wins) and pathext-exe-beats-cmd
(rank order): here NOTHING PATHEXT-legal exists, so resolution finds nothing.

## Workaround

- Ship .cmd (or .exe) alongside any extensionless POSIX shim when Windows is a
  target; fixtures must create platform-appropriate shims.
- Diagnosis rule: "ENOENT but the file is right there on PATH" on Windows =
  check the extension against PATHEXT first.

## Refs

- <https://github.com/lidge-jun/codexclaw/commit/b4be8c171f14e1fdbeec006f0fe5496a7e2caeac>
