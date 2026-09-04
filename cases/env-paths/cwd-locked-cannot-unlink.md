---
id: cwd-locked-cannot-unlink
title: "A test that chdir()s into a temp dir and deletes it cannot exist on Windows: the process's own cwd is locked"
category: env-paths
versions: "both"
failure: hard-error
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/actions/runs/33920624827
  - https://github.com/lidge-jun/opencodex/commit/9e6656641
ontology:
  affects: [env-windows, runtime-bun, runtime-node]
  manifests_as: [error-ebusy]
  caused_by: [mechanism-mandatory-file-locking, mechanism-cwd-handle-held]
  mitigated_by: [workaround-platform-skip-with-reason]
  unsafe_fix: [workaround-chdir-away-before-delete, workaround-retry-transient-remove]
---

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
