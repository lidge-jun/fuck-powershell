---
title: "bare npm is ENOENT and npm.cmd is EINVAL - the same tool, two different lies"
description: "aliases landmine — hard-error (both)"
sidebar:
  label: "npm spawn: ENOENT & EINVAL"
---

<p class="case-eyebrow">aliases · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#pathext-resolution">pathext-resolution</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#cmd-bat-spawn-hardening">cmd-bat-spawn-hardening</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">ENOENT, EINVAL</span></div><div class="row"><span class="k">Mechanism</span><span class="v">pathext resolution, cmd bat spawn hardening</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">comspec dispatch</span></span></div></div>

# bare npm is ENOENT and npm.cmd is EINVAL - the same tool, two different lies

## Symptom

Any Node program that spawns a package-manager CLI dies on Windows, and the two
obvious spellings fail with two *different* errors, which sends you down two
different wrong paths:

```
spawnSync npm ENOENT
spawnSync npm.cmd EINVAL
```

`ENOENT` reads as "npm is not installed" and `EINVAL` reads as "bad arguments".
Neither is true. npm works fine from the same shell.

## Repro

```js
const { spawnSync } = require("node:child_process");
spawnSync("npm", ["--version"], { encoding: "utf8" }).error.code;     // ENOENT
spawnSync("npm.cmd", ["--version"], { encoding: "utf8" }).error.code; // EINVAL
```

Verified on Windows 11, Node 22.14 and 24.19.

## Cause

Two unrelated facts stacked:

1. There is no file named `npm` on disk. PATHEXT resolution is a *shell*
   behavior, and `spawnSync` without `shell: true` does not perform it, so the
   bare name genuinely does not exist -> `ENOENT`.
2. `npm.cmd` does exist, but Node refuses to spawn `.cmd`/`.bat` shell-less
   after the CVE-2024-27980 hardening -> `EINVAL`.

So the correct-looking fix for the first error walks straight into the second.

## Why `shell: true` is not the answer

It is the first thing everyone reaches for, and it is a security regression when
the command is user-supplied: Node does not escape cmd metacharacters in that
mode, so an argument containing `&` or `^` becomes command injection. This repo's
own `oss-native-arg-quoting` case is the same wound from the other side.

## Workaround

Resolve the command yourself, then route by extension:

```js
// PATH x PATHEXT walk -> absolute path
// .exe  -> spawn directly
// .cmd/.bat -> cmd.exe /d /s /c "<caret-escaped line>" with
//             windowsVerbatimArguments: true
```

Prefer `.exe` over `.cmd`, and never `.ps1` (see `npm-ps1-not-comspec`).

---

`npm-ps1-not-comspec` covers the `.ps1` shim winning the PATH race. This is the
adjacent trap: the `.cmd` shim is the one you are *told* to prefer, and Node
refuses it too. Worth its own entry because the fix is different (an escaped
ComSpec hop, not a preference reorder) and the error pair is what people search.

## Real-world hit

lidge-jun/codexclaw#40 — `cxc receipt test -- npm test` could not run on Windows,
which blocked the documented path to close a work phase.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/1>
- <https://github.com/lidge-jun/opencodex/commit/9eaff979748d5b85b03d7529131472515a87a7e8>
- <https://github.com/lidge-jun/cli-jaw/commit/911b74ad31e6c23cb03c80f1c456c36da05eef3b>
