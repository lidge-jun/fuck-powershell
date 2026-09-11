---
title: "kill -9 on a wedged Windows test run leaves a held fixture directory; the next run reports 22 failures in a file that is green on a clean tree"
description: "ci-agents landmine — misleading-error (both)"
sidebar:
  label: "killed run contaminates next run"
---

<p class="case-eyebrow">ci agents · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#mandatory-file-locking">mandatory-file-locking</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#no-process-group">no-process-group</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#unowned-child-lifetime">unowned-child-lifetime</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, bun</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">mandatory file locking, no process group, unowned child lifetime</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">clean fixture debris before measuring</span></span></div></div>

# kill -9 on a wedged Windows test run leaves a held fixture directory; the next run reports 22 failures in a file that is green on a clean tree

## Symptom

A full-suite shard on a self-hosted Windows box wedges; you `kill -9` it and move on. The
NEXT run — different runtime, different branch, nothing in common with the killed one except
the machine — fails 22 of 22 cases in `tests/oauth-store-multi.test.ts`, all from the
`beforeEach`:

```
error: EPERM: operation not permitted, rm 'C:\ocxwin\repo\tests\.tmp-oauth-store-multi-test'
      at removeTreeWithRetry (tests/helpers/remove-tree.ts:28:83)
      at tests/oauth-store-multi.test.ts:44          (beforeEach)
(fail) multi-account auth store > legacy single-credential auth.json ... [5274.25ms]
```

Every case takes ~5.2 s — the retry helper's full 50 × 50 ms budget. The symptom matches an
existing corpus case (`async-child-holds-dir-after-stop`: a fire-and-forget `icacls.exe` holds
the directory) precisely enough that it was diagnosed as that, planned as an 18-file migration,
and passed three audit rounds before anyone ran the falsification probe.

## Repro

```bash
# 1. start a long suite run on the box
bun test --isolate tests --shard=3/4 &
# 2. wait until a fixture directory exists under tests/.tmp-*, then kill the run hard
kill -9 <bun pid>
# 3. run any file that uses that fixture path
bun test --isolate tests/oauth-store-multi.test.ts     # → 22 fail, EPERM in beforeEach
# 4. remove the debris by hand and rerun
rm -rf tests/.tmp-oauth-store-multi-test
bun test --isolate tests/oauth-store-multi.test.ts     # → 22 pass, 1.4 s
```

Recreating the debris WITHOUT a killed run behind it also passes, so the directory itself is
not the problem; something the killed run left alive was holding it.

## Cause

`kill -9` on the parent Bun process does not kill what it spawned (`kill-hits-one-pid-or-the-whole-tree`).
Whatever survived kept a handle on the fixture directory, and Windows' mandatory locking then
refused every later delete until that holder went away. The exact holder was never identified
because the directory was deleted before a handle-owner snapshot was taken — and Windows closes
a process's handles at exit, so "the dead process still holds it" is NOT a valid explanation
even though it is the intuitive one.

What made this expensive was not the lock but the diagnosis. The failure had the exact shape
of a documented mechanism, so it was classified instead of measured: the `icacls` code path was
verified REACHABLE and that was taken as proof it was REACHED. A preload that stubbed both
`icacls` runners and logged every invocation showed 22 failures and zero invocations — the
mechanism never ran.

## Workaround

Before any measurement a conclusion will depend on:

```bash
cd <checkout>
ls -d tests/.tmp-* 2>/dev/null        # fixture debris from a previous run? remove it
ps | grep bun                         # survivors from a killed run? kill them first
```

When a held-directory failure appears, take the handle-owner snapshot BEFORE deleting anything
(`handle.exe <path>`, `openfiles /query`, or Resource Monitor); once the directory is gone the
question cannot be answered.

And when a symptom matches a corpus case exactly: write the falsification condition into the
plan before implementing, and run it first. Here that was "stub the runner and count
invocations" — one two-minute probe against roughly three hours of planning built on the wrong
answer. A corpus match is a hypothesis with a good prior, not a diagnosis.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/8d04c8048>
- <https://github.com/lidge-jun/opencodex/blob/codex/260905-windows-suite-stabilization/devlog/_plan/260905_windows_suite_stabilization/007_acl_defect_retracted.md>
