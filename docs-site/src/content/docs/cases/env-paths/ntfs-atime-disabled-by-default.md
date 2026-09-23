---
title: "A test that proves 'the file was read' by watching atime move cannot see the read on Windows: NTFS last-access updates are disabled by default"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "ntfs atime disabled by default"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#ntfs-last-access-disabled">ntfs-last-access-disabled</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, actions runner, bun, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">VACUOUS PASS, ASSERTION MISMATCH</span></div><div class="row"><span class="k">Mechanism</span><span class="v">ntfs last access disabled</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">spy the syscall not the metadata</span></span></div></div>

## Symptom

A cache test wants to prove two things: a burst of calls inside the TTL does NOT read the
backing file, and an explicit invalidation DOES read it on the next call. It observes the read
through the filesystem — pin `atime` sixty seconds into the past, call the code, check whether
`atime` moved:

```ts
function markStoreUnread() { utimesSync(path, new Date(Date.now() - 60_000), statSync(path).mtime); }
function storeWasRead()    { return statSync(path).atimeMs > Date.now() - 30_000; }
```

On Linux and macOS this is a clean, stub-free observation and all seven cases pass. On
`windows-latest` the three cases that assert "was read" fail:

```
(fail) removing an account invalidates immediately, not after the TTL
  expect(storeWasRead()).toBe(true)   Expected: true   Received: false
```

and the one case that asserts "was NOT read" passes — but it would also pass if the cache
were broken and the file were read twenty-five times. That is the worse half of the symptom: a
green test that cannot go red.

## Repro

```bash
PS> fsutil behavior query DisableLastAccess
DisableLastAccess = 3  (System Managed, Last Access Time Updates DISABLED)
```

```ts
// bun --eval, on windows-latest
const p = join(mkdtempSync(join(tmpdir(), "atime-")), "auth.json");
writeFileSync(p, "{}");
utimesSync(p, new Date(Date.now() - 60_000), statSync(p).mtime);
const before = statSync(p).atimeMs;
readFileSync(p, "utf-8");
const after = statSync(p).atimeMs;
console.log({ before, after, moved: after > before });
// → { before: 1788564769875, after: 1788564769875, moved: false }
```

## Cause

NTFS has not updated last-access time on ordinary reads since Windows Vista/7 on client SKUs
(`NtfsDisableLastAccessUpdate = 1`). Windows 10 1803+ and Server 2019+ replaced the boolean
with a "system managed" mode (values 2/3): updates are enabled only on small volumes (< 128 GB)
and, even then, coalesced to at most one update per hour. The hosted runner's volume reports
`3` — managed, disabled. So `readFileSync` completes, the bytes are returned, and the
metadata the test is watching does not change.

The observation was never wrong about what it measured; it measured the wrong thing. atime is
a *side effect* of a read on filesystems that choose to record it, not evidence of the read.

## Workaround

Observe the syscall, not the metadata. A pass-through spy on `readFileSync` filtered to the
one path that matters sees every read on every platform and changes nothing about how the
code under test behaves:

```ts
let readSpy: ReturnType<typeof spyOn> | undefined;
beforeEach(() => { readSpy = spyOn(fs, "readFileSync"); });   // no mockImplementation
afterEach(() => { readSpy?.mockRestore(); });

function authReadCount() {
  const target = join(home, "auth.json");
  return (readSpy?.mock.calls ?? []).filter(([p]) => String(p) === target).length;
}
function markStoreUnread() { before = authReadCount(); }
function storeWasRead()    { return authReadCount() > before; }
```

The exact-path filter matters: the store module also reads lock files, refresh-intent files,
and a raw peek path, and none of them can satisfy the cache under test.

Prove the new observer with an ablation, not by reading: disable the cache-hit branch and the
"burst shares one read" case must go red. Here it did (Expected false, Received true) — which
the atime version could not do on Windows even with the cache removed.

Turning last-access updates on for the runner (`fsutil behavior set DisableLastAccess 0`) is
the unsafe fix: it needs elevation, it does not survive a fresh runner image, and it still
leaves the test asserting on a filesystem policy instead of on the read.

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/33929916059>
- <https://github.com/lidge-jun/opencodex/pull/3555>
- <https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/fsutil-behavior>
