---
id: test-budget-sized-from-local-timing
title: "A per-test timeout sized from a 450 ms local run kills a three-child test that takes 8-19 s on windows-latest, then the leftover children obscure the message"
category: ci-agents
versions: "both"
failure: misleading-error
context: [ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/actions/runs/33945431119
  - https://github.com/lidge-jun/opencodex/pull/3629
  - https://github.com/lidge-jun/opencodex/actions/runs/33941712300
  - https://github.com/lidge-jun/opencodex/pull/3610
  - https://github.com/lidge-jun/opencodex/actions/runs/33920624827
  - https://github.com/lidge-jun/opencodex/actions/runs/33923803071
  - https://github.com/lidge-jun/opencodex/actions/runs/33926041666
  - https://github.com/lidge-jun/opencodex/commit/cfc8de963
ontology:
  affects: [env-windows, env-actions-runner, runtime-bun]
  manifests_as: [error-test-timeout, error-enoent, error-unhandled-rejection]
  caused_by: [mechanism-hosted-runner-variance, mechanism-unowned-child-lifetime]
  mitigated_by: [workaround-named-spawn-budget, workaround-reap-before-delete, workaround-class-budget-not-case]
  unsafe_fix: [workaround-raise-one-failing-case]
---

# A per-test timeout sized from a 450 ms local run kills a three-child test that takes 8-19 s on windows-latest, then the leftover children obscure the message

## Symptom

One case in a file of six times out on the hosted Windows shard. Three things print, and only
the first is the real story:

```
killed 2 dangling processes
(fail) startup and CLI sync-cache cannot write models_cache while another process owns K [15536.76ms]
  ^ this test timed out after 15000ms.

# Unhandled error between tests
ENOENT: no such file or directory, open '...\ocx-retained-cache-3FtvI4\lock-release'
      at tests/codex-retained-root-serialization.test.ts:215:12     ← the finally
```

Raise that one case's budget and the failure MOVES to the next case in the file
(20 s budget, ran 20.14 s), now with a third artefact: an unhandled
`sync exited before provider barrier (143)` — the killed child's exit surfacing through a
promise nobody was awaiting any more. Locally the whole file runs in 3.5 s and every case is
green, so nothing reproduces on a developer machine.

## Repro

```ts
// Any test that boots real children on a shared hosted runner.
test("three children", async () => {
  const holder = Bun.spawn([process.execPath, "--eval", holdLockScript]);      // boot #1
  await waitForMarker(holder);                                                  // 8-11 s on windows-latest
  const probe = Bun.spawn([process.execPath, "--eval", importServerScript]);   // boot #2
  await probe.exited;
  Bun.spawnSync([process.execPath, "run", "src/cli/index.ts", "sync-cache"]);  // boot #3
  // ...assertions...
}, 15_000);   // ← chosen because it ran in 448 ms on the author's laptop
```

Measured on the same `windows-latest` job class across three consecutive runs, the SAME first
case took 15.5 s (timeout), 18.7 s, and 8.5 s. A 2× spread on identical work is normal there.

## Cause

Three independent things stack:

1. **The budget measured the wrong machine.** A `bun --eval` child that imports a large module
   graph boots in ~150 ms locally and 8-11 s on a windows-latest runner that is also running
   three sibling Bun pools. Sizing to the local number is the classic error; the repository's
   own `test-budget.ts` names it and it still happened.
2. **Timeouts leave children behind.** Bun's per-test timeout aborts the test body but does not
   reap what the body spawned. "killed N dangling processes" is Bun cleaning up at the end,
   after `afterEach` has already run — which is what produces the next artefact.
3. **Teardown ran against the wrong world.** `afterEach` removed the sandbox root while the
   timed-out test's `finally` was still queued; the `finally` then wrote a release marker into
   a directory that no longer existed (ENOENT). And a `Promise.race` whose losing branch was a
   rejecting `child.exited.then(...)` stayed pending after the barrier won, so the later kill
   rejected it with nobody awaiting — an "unhandled error between tests".

Together they turn one slow boot into three error messages, none of which say "the budget is
too small for this runner".

## Workaround

Fix the class, not the case, and make teardown own the children.

```ts
// 1. Budget from the repository's named constant, not a number.
//    SPAWN_BUDGET_MS is documented as "real child process" and is the same category
//    for every case in this file — budgeting only the one that failed moved the failure.
}, SPAWN_BUDGET_MS);

// 2. Register every spawn on the fixture and reap BEFORE deleting its root.
async function teardownSandbox(s: Sandbox) {
  for (const m of s.releaseMarkers) { try { writeFileSync(m, "release"); } catch {} }
  for (const c of s.children) if (c.exitCode === null) c.kill();
  await Promise.all([...s.children].map(c => c.exited));   // then, and only then, rmSync
}
afterEach(async () => { for (const s of sandboxes.splice(0)) { await teardownSandbox(s); removeTreeWithRetry(s.root); } });

// 3. Detach the losing race branch so a later kill cannot become an unhandled rejection.
const exitedEarly = child.exited.then(async code => { throw new Error(`exited before barrier (${code})`); });
exitedEarly.catch(() => undefined);          // attach NOW, not in a finally
await Promise.race([barrier, exitedEarly]);
```

Before raising any budget, run the ablation the budget file demands: disable the behaviour the
test guards and confirm the case goes red. Here a one-token change (`BEGIN IMMEDIATE` →
`BEGIN` in the lock) turned `expect(existsSync(cachePath)).toBe(false)` red, so the wait was
intrinsic and the case was not vacuous.

Verify the teardown half with a probe, not by reading: insert a 5 s sleep after the barrier
under a 3 s budget. The original reports the timeout PLUS the unhandled 143; the fixed version
reports the timeout alone. Two intermediate attempts (resolve-to-Error; `catch` in a
`finally`) still failed that probe — the handler must be attached before the race, because a
rejection that fires between the race settling and a later `catch` is already unhandled.

Raising only the one failing case is the unsafe fix: on a runner with 2× variance the next
case is simply the next one over the line, and each round costs a 25-minute CI cycle.

## Counterexample: expensive setup is not an intrinsic wait

The quota-reset claim-ceiling test in Windows run 33941712300 took 99.26 seconds
against a 60-second budget. Its loop attempted 2,000 claims, but the assertion
was about a map cap of 1,024, not about a thousand successful durable writes.
Precisely 1,024 successful insertions persist during that setup; later
furthest-deadline newcomers are evicted before persistence. The writer performs
synchronous atomic persistence and Windows ACL work. Do not call this measured
fsync overhead without a trace identifying fsync.

PR #3610 seeds 1,023 valid live records, then performs real insertions that reach
and exceed the cap. It checks exact count, eviction victim, persisted contents,
rehydration, and rejection of a furthest-deadline newcomer. Only two production
writes remain. Removing insertion pruning makes this fixture fail with 1,025
instead of 1,024; restoring it passes. No cap, timeout, durability, or ACL policy
is weakened. Seed ordinary setup, but still cross the behavior's boundary through
the public operation, and prove the test fails when that behavior is removed.

## An outer budget cannot repair a shorter readiness deadline

OpenCodex's native-profile startup fixture documented10–18second Windows child
boots but used a15-second generic deadline while waiting for the real port.
Twelve fresh process scenarios also shared one120-second test. Run33945431119
failed readiness before that aggregate test budget was exhausted.

A controlled local fault delayed port publication16seconds. The old waiter
failed at15.0seconds with the child still running; cleanup observed a healthy
exit0 and port publication at16.2seconds. Using the existing intrinsic spawn
budget passed the same fault and all admission/convergence assertions. This is
a test-harness boundary proof, not a claim that an unexplained Windows kernel
stall was reproduced locally.

PR #3629 makes each scenario an independently budgeted test, retains the whole
scenario matrix, drains both child streams immediately, detects early exit,
and retains primary plus cleanup errors. A forced early failure is reported
in0.26seconds instead of masquerading as a45-second readiness timeout. A forced
shutdown stall is killed/joined within its10-second cleanup bound; the combined
readiness/cleanup fault retains both errors. Disabling the actual native-main
gate still turns the pre-recovery request into200 and fails the assertion.

Use operation-specific bounds, preserve their ordering, and measure the stage
that expired. Never assume that a generous outer test timeout can compensate
for an inner deadline that rejects a healthy child first.
