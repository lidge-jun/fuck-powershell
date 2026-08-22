---
title: "your atomic write fails intermittently on Windows because antivirus opened the file you are replacing, milliseconds ago"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "atomic rename loses to scanner"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#mandatory-file-locking">mandatory-file-locking</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">EBUSY, EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">mandatory file locking</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">bounded rename retry</span></span></div></div>

## Symptom

The write-temp-then-rename pattern — the standard way to publish a file without
a torn read — throws on Windows for no reason you can reproduce:

```
Error: EPERM: operation not permitted, rename 'config.toml.tmp' -> 'config.toml'
```

Once a week. On one machine. Never on yours. Retrying by hand always works, which
is the tell.

The cost is not the failed write; it is that the file was not published while
your program believes the operation completed or failed cleanly. A journal entry
goes missing, a manifest keeps a stale value, a restore has nothing to restore.

## Repro

Deterministically, by holding the destination the way a scanner does:

```powershell
PS> "old" | Set-Content dest.txt
PS> "new" | Set-Content dest.txt.tmp
PS> $h = [IO.File]::Open("$PWD\dest.txt", 'Open', 'Read', 'None')   # no share mode
PS> node -e "require('fs').renameSync('dest.txt.tmp','dest.txt')"
Error: EPERM: operation not permitted, rename ...
PS> $h.Close()      # now it succeeds
```

In production nobody opens it explicitly. Defender, a backup agent, the search
indexer, or a cloud-sync client takes that handle for a few milliseconds after
you write the temp file, which is exactly when you rename.

## Cause

POSIX `rename(2)` is atomic and unconditional: it does not care who has the
destination open, because unlink semantics let the old inode live on for existing
holders.

Windows has no such escape. A handle on the destination opened without
`FILE_SHARE_DELETE` blocks the replace, and the failure surfaces as `EPERM`,
`EBUSY`, or `EACCES` depending on which layer refused. All three mean the same
thing here: someone else has it, briefly.

"Briefly" is the important word. These holds are transient by nature — a scanner
reads and closes — so the operation that failed will succeed a moment later. That
is what separates this from a genuine permission problem, and it is why a single
attempt is the wrong shape for a durable publish on Windows.

## Workaround

Retry the rename a bounded number of times, only on the transient codes, only on
Windows:

```js
const TRANSIENT = new Set(["EPERM", "EBUSY", "EACCES"]);

function renameAtomic(from, to) {
  const attempts = process.platform === "win32" ? 3 : 1;
  for (let i = 0; i < attempts; i++) {
    try { return renameSync(from, to); }
    catch (err) {
      const last = i === attempts - 1;
      if (last || !TRANSIENT.has(err.code)) throw err;
      sleepSync(25 * (i + 1));    // 25ms, then 50ms
    }
  }
}
```

Keep the bound small and honest. Two retries covers a scanner; a longer loop
turns a real permission error into a hang, and it stops being a fix and starts
being a guess.

Apply it at EVERY durable publish, not just the one that failed first. The
failure is a property of the platform, not of that call site, so a codebase with
one hardened writer and eight bare `renameSync` calls has one hardened writer and
eight latent bugs.

And do not use this for directory moves. Those fail on Windows for different
reasons and retrying will not help.

---

`unlink-while-open-ebusy` is the same mandatory-locking mechanism from the delete
side, where the holder is usually your own orphaned child. Here the holder is
someone else's process, it lets go on its own, and the fix is patience rather
than cleanup.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/c5c6644d7>
- <https://github.com/lidge-jun/opencodex/commit/fcc9e5022>
