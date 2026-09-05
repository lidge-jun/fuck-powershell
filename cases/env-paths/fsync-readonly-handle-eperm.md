---
id: fsync-readonly-handle-eperm
title: "fsyncSync on a handle opened with 'r' throws EPERM on Windows, so a durable write that reopens read-only to flush fails only there"
category: env-paths
versions: "both"
failure: hard-error
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/actions/runs/33590540220
  - https://github.com/lidge-jun/opencodex/blob/dev/tests/codex-transition-state-adoption.test.ts
ontology:
  affects: [env-windows, runtime-node, runtime-bun, env-win32-api]
  manifests_as: [error-eperm]
  caused_by: [mechanism-flush-needs-write-access]
  mitigated_by: [workaround-fsync-on-rdwr-handle]
---

# fsyncSync on a handle opened with 'r' throws EPERM on Windows, so a durable write that reopens read-only to flush fails only there

## Symptom

A write-then-flush routine that is correct on Linux and macOS dies on Windows at the flush:

```
error: EPERM: operation not permitted, fsync
    at fsyncRegularFile (src/lib/service-secrets.ts:70)
    at writeTokenBackup (src/lib/service-secrets.ts:81)
```

The file is fully written. Nothing is locked. The same code has run for months on POSIX
runners. Every caller of the routine — token backup, replace, restore, and a child process
that calls it on startup — fails identically, which reads like a permissions problem on the
directory until you look at the flags.

## Repro

```js
import { closeSync, fsyncSync, openSync, writeFileSync } from "node:fs";
writeFileSync("probe", "x");
const fd = openSync("probe", "r");
fsyncSync(fd);      // Linux/macOS: fine. Windows: EPERM
closeSync(fd);
```

```powershell
PS> node repro.mjs
node:fs:...  Error: EPERM: operation not permitted, fsync
```

Open with `"r+"` and the same call succeeds.

## Cause

`fsync` on Windows is `FlushFileBuffers`, and `FlushFileBuffers` requires a handle with
`GENERIC_WRITE` access. A handle opened for reading only does not have it, so the kernel
refuses with `ERROR_ACCESS_DENIED`, which libuv maps to `EPERM`.

POSIX `fsync(2)` has no such rule: any descriptor for the file will do, because the flush is
about the file's dirty pages, not the descriptor's mode. That asymmetry is why "open read-only,
fsync, close" is a common idiom in code that separates the write from the durability step —
the write helper closes its own descriptor, and a later step reopens the path just to flush.

## Workaround

Open the flush handle with write access:

```ts
function fsyncRegularFile(path: string): void {
  const fd = openSync(path, "r+");   // not "r"
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
```

`"r+"` fails if the file does not exist, which is the right behaviour for a flush of something
you just wrote. If the file may be read-only on disk, `O_RDWR` will fail too; in that case
flush through the descriptor the write used before closing it, which is also cheaper.

Pin it with a test that spies on `openSync` and asserts no `"r"` reaches the flush path; the
contract is invisible on POSIX otherwise. Directory handles are a separate story — Windows
cannot fsync them at all, and that path should be best-effort.

