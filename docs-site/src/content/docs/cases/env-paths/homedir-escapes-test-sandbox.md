---
title: "os.homedir() escapes a Windows test sandbox when HOME disagrees with USERPROFILE"
description: "env-paths landmine — misleading-error (both)"
sidebar:
  label: "homedir escapes test sandbox"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#case-insensitive-filesystem">case-insensitive-filesystem</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, bun</span></div><div class="row"><span class="k">Fails as</span><span class="v">ASSERTION MISMATCH</span></div><div class="row"><span class="k">Mechanism</span><span class="v">case insensitive filesystem</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">canonical path key</span></span></div></div>

## Symptom

A test puts its temporary home under a sandbox and asserts every service state
path begins with that directory. The assertion passes on POSIX but fails on a
Windows runner: one state path points into the runner's effective user home
instead of the test's temporary home. CI diagnostics may show `RUNNER~1` while
the API returns the long profile spelling for the same location.

## Repro

```ts
import { homedir } from "node:os";
import { join } from "node:path";

process.env.HOME = "C:\\sandbox\\home";
process.env.USERPROFILE = "C:\\Users\\account";
console.log(homedir());
// Windows: C:\Users\account, not C:\sandbox\home

const statePath = join(homedir(), ".opencodex", "service.json");
statePath.startsWith(process.env.HOME); // false
```

Even when both strings name the same directory, raw `startsWith` can fail when
the runner supplies different letter casing or an 8.3 short-name spelling.

## Cause

On Windows, `os.homedir()` derives the home from `USERPROFILE`; setting `HOME`
alone does not redirect it. A legacy code path that calls `homedir()` can
therefore escape a test's sandbox if the fixture only overrides `HOME`.

The assertion adds a second path-identity assumption. Windows paths can differ
in letter casing or use a short-name alias while resolving to the same directory.
String-prefix comparison neither resolves those aliases nor verifies a path
boundary (`C:\\sandbox\\home-old` also starts with `C:\\sandbox\\home`).

OpenCodex's `tests/service/service-claim.test.ts` exposed the assertion on
`windows-latest` in run 35816970127. The exact patch was still under review when
this case was recorded; this documents the observed mechanisms, not an unverified
final fix.

## Workaround

- Inject the test's home through the same configuration or resolver the code
  under test uses. If a legacy path reads `os.homedir()`, set and restore the
  platform's effective home variable (`USERPROFILE` on Windows) as part of the
  fixture, without leaking it to later tests.
- For containment of existing paths, resolve both sides with the platform's
  native filesystem resolution (`realpathSync.native` on Bun/Node Windows),
  then compare normalized path components with a separator boundary. Do not
  rely on raw `startsWith`, casing alone, or suffix equality.
- Do not skip the assertion on Windows: that hides an actual sandbox escape.
- Do not weaken it to a suffix or basename check: a path outside the sandbox can
  share the same suffix and still pass.

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/35816970127>
