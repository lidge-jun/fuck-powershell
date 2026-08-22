---
id: pathext-bare-name-enoent
title: "An extensionless shim on PATH is invisible to Windows spawn — ENOENT with the file right there"
category: env-paths
versions: "both"
failure: hard-error
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/codexclaw/commit/b4be8c171f14e1fdbeec006f0fe5496a7e2caeac
---

# An extensionless shim on PATH is invisible to Windows spawn — ENOENT with the file right there

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
