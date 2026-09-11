---
title: "node:path delimiter follows the HOST, so win32 PATH logic resolves nothing when tested from Linux"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "node PATH host delimiter"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#path-delimiter">path-delimiter</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, windows, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">path delimiter</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">path win32 delimiter</span></span></div></div>

# node:path delimiter follows the HOST, so win32 PATH logic resolves nothing when tested from Linux

## Symptom

Windows PATH-resolution code is correct on Windows and silently resolves
**nothing** when the same function is exercised from Linux — a unit test, a CI
matrix, a cross-platform test that passes `platform: "win32"` as a parameter.

Nothing throws. The walk just finds no candidates, and the caller falls through
to whatever its "not found" branch does. On Windows the test passes, so the bug
ships in the direction nobody looks.

## Repro

```js
import { delimiter } from "node:path";

// A Windows PATH, being parsed by win32-only resolution logic
const winPath = "C:\\a;C:\\b;C:\\c";
winPath.split(delimiter);
// on Windows: ["C:\\a", "C:\\b", "C:\\c"]
// on Linux:   ["C:\\a;C:\\b;C:\\c"]   <- one bogus entry, no error
```

## Cause

`node:path`'s `delimiter` (and `sep`) follow the **host**, not the data. A
Windows PATH is always `;`-separated regardless of where the string is being
parsed. The moment you make platform a *parameter* — which is exactly what you do
to make win32 logic testable from CI — the host-derived constant stops matching
the input.

`path.win32.delimiter` exists and is the honest fix, but the bare import is what
editors autocomplete and what reads as "correct, cross-platform" in review.

## Workaround

- Split a Windows PATH on a literal `";"`, or use `path.win32.delimiter`
  explicitly. Same for `path.win32.sep` / `path.posix.sep`.
- Treat any host-derived constant inside platform-parameterized code as a bug:
  if `platform` is an argument, `delimiter`, `sep`, `homedir()` and
  `process.platform` must not appear in the same function.
- Assert the split in a test that runs on Linux, not just on Windows.

## Why it belongs here

This is the mirror image of most cases in this archive: not a POSIX assumption
exploding on Windows, but **Windows-handling code quietly failing everywhere
else**. It is the failure mode you get *after* you do the right thing and make
your win32 path logic testable off-Windows.

## Real-world hit

Shipped in three byte-identical copies of a shared helper in
lidge-jun/codexclaw and only surfaced when a win32-only resolver was exercised
from a WSL/Linux test lane.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/5>
- <https://github.com/lidge-jun/cli-jaw/commit/80b3d4ab039b9fc9e6d7029734c7cdd573e335e8>
