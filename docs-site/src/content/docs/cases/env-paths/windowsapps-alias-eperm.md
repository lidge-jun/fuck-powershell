---
title: "a WindowsApps alias on PATH spawns EPERM while passing every readability and reparse-point probe"
description: "env-paths landmine — misleading-error (both)"
sidebar:
  label: "windowsapps alias EPERM"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#appexeclink">appexeclink</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, cmd, windows, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">appexeclink</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">skip windowsapps</span></span></div></div>

# a WindowsApps alias on PATH spawns EPERM while passing every readability and reparse-point probe

## Symptom

A tool installed from the Microsoft Store (or any app that ships an execution
alias) is on PATH, and spawning it fails with `EPERM` — not `ENOENT`. cmd.exe
says "Access is denied." Running the same name interactively works fine.

`EPERM` sends you hunting for a permissions or antivirus problem. There isn't one.

## Repro

```js
// PATH contains C:\Program Files\WindowsApps\...\codex.exe
const { spawnSync } = require("node:child_process");
const p = "C:\\Program Files\\WindowsApps\\OpenAI.Codex_.../codex.exe";

require("node:fs").accessSync(p, require("node:fs").constants.R_OK); // OK
require("node:fs").accessSync(p, require("node:fs").constants.X_OK); // OK
require("node:fs").lstatSync(p).isSymbolicLink();                    // false

spawnSync(p, ["--version"]).error.code;                              // EPERM
```

Measured on Windows 11 with the Codex desktop app installed. The file is
**readable**, passes **X_OK**, is **not a reparse point**, and reports a real size
(297 MB) — and `CreateProcess` still refuses it.

## Cause

Store-packaged apps expose an *app execution alias*. The shell knows how to
activate the package behind it; a direct `CreateProcess` does not, and the
refusal surfaces as `EPERM`.

The nasty part is the detection story. Every heuristic that sounds right fails:

| Probe | Result | Useful? |
|---|---|---|
| `existsSync` | true | no |
| `access(R_OK)` | passes | no |
| `access(X_OK)` | passes | no |
| `lstat().isSymbolicLink()` | false | no |
| size looks like a stub | 297 MB | no |

The advice you find online — "skip unreadable reparse points" — does not catch
this binary at all. The only reliable discriminator is the `WindowsApps` **path
segment itself**.

## Workaround

Filter the PATH walk by whole path segment, and keep a shell hop as the fallback,
since the shell *can* start the alias:

```js
const isStoreAlias = (p) => /(^|[\\/])WindowsApps([\\/]|$)/i.test(p);
```

Match it as a whole segment so a directory named `MyWindowsAppsBackup` is not
swept up. Ladder that worked: explicit override env var, then a PATH/PATHEXT walk
that skips WindowsApps, then a caret-escaped `cmd.exe` hop.

## Real-world hit

lidge-jun/codexclaw#33 — a trust-registration command died here on every run, and
because the failure was in a *verification* step the tool rolled back a write that
had actually succeeded.
Fix: https://github.com/lidge-jun/codexclaw/commit/071eb40

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/2>
