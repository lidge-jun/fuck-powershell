---
title: "npm update fails with EBUSY because your server exited hours ago but its child process still holds the file"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "unlink while open ebusy"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">interactive</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#mandatory-file-locking">mandatory-file-locking</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">EBUSY, EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">mandatory file locking</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">kill process tree</span></span></div></div>

## Symptom

A routine operation on a directory fails, and the error blames the filesystem for
something you did not do:

```
npm error code EBUSY
npm error syscall rename
npm error EBUSY: resource busy or locked
```

Deleting a build directory, replacing a binary, updating a global package,
cleaning a temp folder — all of them hit it. Rebooting fixes it, which tells you
it is a lock and tells you nothing about whose.

The usual culprit is a process you believe is dead. You pressed Ctrl+C on the
parent; the parent exited; a child it spawned is still running and still has the
file open.

## Repro

```powershell
PS> $f = [IO.File]::Open("$PWD\held.txt", 'Create', 'Write', 'None')
PS> Remove-Item held.txt
Remove-Item : The process cannot access the file 'held.txt' because it is being used by another process.
PS> $f.Close()          # now it deletes
```

On Linux or macOS the same sequence succeeds: the directory entry disappears
immediately and the bytes stay alive for the holder until it closes.

To find the holder:

```powershell
PS> Get-Process | Where-Object { $_.Modules.FileName -like "*held*" }
# or, for handles rather than modules, Sysinternals handle.exe -a held.txt
```

## Cause

POSIX unlink removes a name, not a file. The inode survives until the last
descriptor closes, so a running process never blocks a delete or a rename.

Windows file locking is MANDATORY, not advisory. A handle opened without
`FILE_SHARE_DELETE` — which is the default in every high-level runtime API,
including Node's `fs.open` and .NET's `File.Open` — makes the OS refuse deletes
and renames for as long as that handle lives. The refusal comes back as `EBUSY`
for a rename and `EPERM` for an unlink, neither of which names the holder.

Two things make it worse than a plain "close your files" problem:

1. A signal handler that calls `process.exit()` synchronously does not give
   sockets, database handles, or child processes time to close. The parent
   vanishes; the handles do not.
2. Windows has no process groups in the POSIX sense, so killing a parent does not
   kill what it spawned. `Ctrl+C` reaches the console group; a detached child does
   not get it, and an orphaned grandchild never does.

That second point is why the lock outlives everything you can see in a task list
you skim.

## Workaround

Make shutdown release handles before the process leaves, and kill the whole tree:

```js
const GRACE_MS = 3000;
for (const sig of ["SIGINT", "SIGTERM", ...(isWin ? ["SIGBREAK"] : ["SIGHUP"])]) {
  process.on(sig, async () => {
    const force = setTimeout(() => process.exit(0), GRACE_MS).unref?.();
    await server.close();          // drain connections
    await db.close();              // release the sqlite handle
    killProcessTree(child.pid);    // taskkill /PID <pid> /T /F on Windows
    process.exit(0);
  });
}
```

`SIGBREAK` matters: Ctrl+Break is a distinct signal on Windows, and a handler
registered only for `SIGINT` leaves the server orphaned when a user presses it.

When you must delete a path that something may hold, retry with backoff rather
than failing on the first `EBUSY` — antivirus and the search indexer take
transient handles on files you just wrote, and those clear on their own within a
second or two.

---

This is the file-lifetime half of the Windows process model.
`startup-artifact-is-not-a-process` is the liveness half: no supervisor owns your
process. Here, no unlink semantics free your file.

## Refs

- <https://github.com/lidge-jun/ima2-gen/commit/19c7335b2>
- <https://github.com/lidge-jun/ima2-gen/commit/513eab41e>
