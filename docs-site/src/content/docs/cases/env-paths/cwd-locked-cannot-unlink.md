---
title: "A test that chdir()s into a temp dir and deletes it cannot exist on Windows: the process's own cwd is locked"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "cwd locked cannot unlink"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#mandatory-file-locking">mandatory-file-locking</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#cwd-handle-held">cwd-handle-held</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, bun, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">EBUSY</span></div><div class="row"><span class="k">Mechanism</span><span class="v">mandatory file locking, cwd handle held</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">platform skip with reason</span></span></div></div>

# A test that chdir()s into a temp dir and deletes it cannot exist on Windows: the process's own cwd is locked

## Symptom

A regression test for "the CLI survives being launched from a deleted directory" passes on macOS
and Linux and fails on Windows in its SETUP, before the assertion:

```
error: EBUSY: resource busy or locked, rm 'C:\Users\user\AppData\Local\Temp\ocx-unlinked-cwd-3epkdD'
      at removeTreeWithRetry (tests/helpers/remove-tree.ts:28:83)
(fail) cli wiring > interactiveGuardOk safely evaluates without throwing when cwd is unlinked [2611.94ms]
```

The 2.6 s is the retry helper spending its whole 50 × 50 ms budget on an operation that can never
succeed, then rethrowing.

## Repro

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "cwd-lock-"));
process.chdir(dir);
rmSync(dir, { recursive: true, force: true });   // POSIX: fine. Windows: EBUSY, every time.
console.log(process.cwd());                       // POSIX prints the dead path; never reached on Windows
```

## Cause

POSIX unlinks a NAME. A process standing in a directory keeps a valid handle to the inode
after the name is gone, so `rmdir` succeeds and `getcwd()` starts failing with ENOENT — which is
exactly the state the test wants to exercise.

Windows holds the current directory as an open handle without `FILE_SHARE_DELETE` for as long
as it IS the current directory. Deleting it is refused with `ERROR_SHARING_VIOLATION`
(`EBUSY`) until some process `chdir`s elsewhere. There is no "directory exists but has no
name" state to enter, so the precondition is unreachable, not merely slow.

This is a different failure class from an unowned child holding a handle
(`async-child-holds-dir-after-stop`): the holder here is the test process itself, and no amount
of waiting or reaping changes that.

## Workaround

Skip the case on Windows, with the platform fact in the predicate's comment so it reads as a
boundary rather than a muted failure:

```ts
// Windows locks a process's cwd: it cannot be unlinked, so the state under test
// cannot exist there. The cwd-healing code path is covered separately.
test.skipIf(process.platform === "win32")("... when cwd is unlinked", () => { /* unchanged */ });
```

Two tempting alternatives are wrong:

- **`chdir` back to the original directory before deleting.** The delete now succeeds and
  the test runs `interactiveGuardOk()` from a perfectly valid cwd, asserting nothing.
- **Inventing a Windows-reachable "bad cwd"** (a revoked ACL, a dropped drive mapping). That
  exercises a different failure mode dressed up to keep the checkmark green.

A skip is honest here because there is no coverage to lose: the platform cannot enter the
state. If Windows coverage of the guard's throw branch is wanted, it belongs in a separate test
that injects the throw directly.

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/33920624827>
- <https://github.com/lidge-jun/opencodex/commit/9e6656641>
