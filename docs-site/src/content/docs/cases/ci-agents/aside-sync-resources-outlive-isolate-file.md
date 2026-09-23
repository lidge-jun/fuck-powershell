---
title: "A stale Aside sync timer and socket outlive their test file in a shared Bun isolate"
description: "ci-agents landmine — misleading-error (both)"
sidebar:
  label: "aside sync resources outlive isolate file"
---

<p class="case-eyebrow">ci agents · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#test-resource-outlives-file">test-resource-outlives-file</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">bun, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">TEST TIMEOUT</span></div><div class="row"><span class="k">Mechanism</span><span class="v">test resource outlives file</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">own request deadline and teardown</span></span></div></div>

## Symptom

A multi-file `bun test --isolate` batch on `windows-latest` intermittently
stalls or crashes after `tests/server/local-aside-sync-capability.test.ts`
starts its third listener. One attempt reached the 480-second process timeout
(job 107037821321); the next ended with:

```
panic(main thread): Segmentation fault at address 0x18
```

The panic occurred in job 107043425787. Every file passed alone, and the
multi-file batch also passed on another run. Treat the segmentation fault as a
Bun runtime bug triggered by leaked handles; no native stack was captured to
establish a deeper crash cause.

## Repro

Run the multi-file isolated test batch containing
`tests/server/local-aside-sync-capability.test.ts` on Bun 1.4.0 and
`windows-latest`. The observed failure was intermittent: the timeout and panic
occurred on consecutive attempts, while each file passed alone and another
batch run passed. Green run 35828289232 passed both Aside tests in a multi-file
isolate process, but its shards had been rebalanced, so it was not an exact
replay of the failing batch.

## Cause

Two ownership gaps let resources outlive the test file inside the shared Bun
process:

1. An `AbortSignal.timeout()` deadline for an Aside sync stayed armed after the
   sync succeeded.
2. The direct-local HTTP request settled before its destroyed socket emitted
   `close`. The socket and a timer could therefore remain active after the test
   file had finished.

The timeout and panic are two observed batch outcomes around that leaked
resource lifetime. The panic is attributed to Bun being triggered by leaked
handles, not to an inferred native stack or a proved internal crash path.

PR #5634 clears the deadline on every exit, keeps an absolute timer that bounds
request and socket teardown, settles exactly once if `close` never arrives or
`destroy()` throws, and awaits `server.stop(true)` during teardown.

## Workaround

Make the request own its deadline and teardown. Clear the deadline on every
exit; use one absolute bound for both the request and socket shutdown; make
settlement idempotent across response, error, timeout, and close events; and
await `server.stop(true)` before the test file completes.

Unsafe workarounds:

- Raising the 480-second batch timeout lets leaked resources remain alive even
  longer and hides the ownership defect.
- Running the test file alone avoids the shared-process boundary that exposed
  the leak; it does not close the resources on success.
- Reordering files only changes when the leak is exposed.

## Refs

- <https://github.com/lidge-jun/opencodex/actions/runs/35828289232>
- <https://github.com/lidge-jun/opencodex/pull/5634>
