---
title: "rmSync hits EPERM right after a clean server.stop() because a fire-and-forget icacls.exe still holds the directory"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "async child holds dir after stop"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#mandatory-file-locking">mandatory-file-locking</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#unowned-child-lifetime">unowned-child-lifetime</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, bun, node, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM, EBUSY</span></div><div class="row"><span class="k">Mechanism</span><span class="v">mandatory file locking, unowned child lifetime</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">shutdown owns children</span></span></div></div>

## Symptom

A test suite that starts a server, stops it with `await server.stop(true)`, and then removes its
scratch home fails in the teardown, not in the test:

```
error: EPERM: operation not permitted, rm 'D:\a\opencodex\opencodex\tests\.tmp-codex-accounts-test'
error: EBUSY: resource busy or locked, rm 'C:\Users\RUNNER~1\AppData\Local\Temp\ocx-api-usage-esM6Go'
```

Four Windows CI shards went red on every branch, including the released `main`, for three days.
Linux and macOS stayed green on the same commits. Individual test bodies passed; the
`afterEach` hook failed, and when the hook shared one fixed directory across cases, the first
failure poisoned every later case in the file (49 of 49 errors in one file, 377 in another were
hooks, not assertions).

## Repro

```js
// child.mjs — any child that touches the directory and outlives its parent's "done"
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

mkdirSync("scratch", { recursive: true });
// icacls holds the directory handle for the duration of the ACL rewrite
spawn("icacls.exe", ["scratch", "/inheritance:r", "/grant:r", "*S-1-5-32-544:(OI)(CI)F"], { stdio: "ignore" });
// "shutdown" that forgot about the child
rmSync("scratch", { recursive: true, force: true });
// → EPERM on Windows; silently fine on Linux/macOS
```

```powershell
PS> node child.mjs
node:fs:...  Error: EPERM: operation not permitted, rm 'scratch'
```

## Cause

Two Windows facts combine:

1. File locking is mandatory. A handle opened without `FILE_SHARE_DELETE` — which is what every
   ordinary process, including `icacls.exe`, holds while it works on a directory — makes the
   kernel refuse `unlink` (`EPERM`) and `rename` (`EBUSY`) until the handle closes. POSIX only
   removes the name; the data lives until the last descriptor goes away, so the same code never
   notices there.
2. Nothing ties a child's lifetime to its parent's notion of "finished". A `spawn` whose promise
   is dropped keeps running. `server.stop()` awaited listeners, background jobs and lifecycle
   hooks — everything the server started on purpose — but not the ACL flight a config read
   kicked off as an optimisation (`hardenConfigDir()` → `hardenSecretDirAsync()`, unawaited,
   introduced to stop the event loop from blocking on a slow `icacls`).

The regression was invisible on the machines developers use, and the CI signal was gated behind
`workflow_dispatch`, so it was attributed to "the hosted runner" for three days. It was the
product: the same suites had passed on the same `windows-latest` image before the async change.

## Workaround

The shutdown contract has to own every child the process started. Scope the flight to the
directory it works on and await it where you await everything else:

```ts
// paths.ts
const flights = new Map<string, Promise<void>>();
export async function flushConfigDirHardening(dir: string): Promise<void> {
  const flight = flights.get(dir);
  if (flight) await flight;
}

// server.ts
const configDir = getConfigDir();            // capture BEFORE the flight starts
server.stop = async () => {
  await closeListeners();
  await backgroundLifecycle.release();
  await flushConfigDirHardening(configDir);  // now rm after stop() is safe
};
```

Prove it with a test that holds the child on a promise and asserts `stop()` stays pending until
the promise resolves; drive it red once by commenting the await out.

Retrying `rmSync` on `EPERM`/`EBUSY` (50 × 50 ms) is a legitimate belt-and-braces for antivirus
and search-indexer handles, and this repo keeps one for fixtures. It is an unsafe *primary* fix
here: it hides the unowned child, the retry budget is a guess, and in production the same
child would still be holding a directory the uninstaller or a home move is about to touch.

---

This is the "who owns the child" half of the file-lifetime story. `unlink-while-open-ebusy`
is the "who owns the file" half; `kill-hits-one-pid-or-the-whole-tree` is what happens when the
parent leaves without either.

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/33590540220>
- <https://github.com/lidge-jun/opencodex/actions/runs/33290817128>
- <https://github.com/lidge-jun/opencodex/commit/e5d588669>
