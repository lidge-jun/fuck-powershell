---
id: homedir-escapes-test-sandbox
title: "os.homedir() escapes a Windows test sandbox when HOME disagrees with USERPROFILE"
category: env-paths
versions: "both"
failure: misleading-error
context: [ci, script, agent]
source: first-party
repro: historical
refs:
  - https://github.com/lidge-jun/opencodex/actions/runs/35816970127
  - https://github.com/lidge-jun/opencodex/pull/5634
ontology:
  affects: [env-windows, runtime-node, runtime-bun]
  manifests_as: [error-assertion-mismatch]
  caused_by: [mechanism-homedir-uses-userprofile]
  mitigated_by: [workaround-pin-test-userprofile]
  unsafe_fix: [workaround-weaken-assertion]
---

# os.homedir() escapes a Windows test sandbox when HOME disagrees with USERPROFILE

## Symptom

A test puts its temporary home under a sandbox and asserts every service state
path begins with that directory. The assertion passes on POSIX but fails on a
Windows runner: one state path points into the runner's effective user home
instead of the test's temporary home.

## Repro

```ts
import { homedir } from "node:os";
import { join } from "node:path";

process.env.HOME = "C:\\sandbox\\requested-home";
process.env.USERPROFILE = "C:\\sandbox\\home";
console.log(homedir());
// Windows: C:\sandbox\home, not C:\sandbox\requested-home

const statePath = join(homedir(), ".opencodex", "service.json");
statePath.startsWith(process.env.HOME); // false
```

## Cause

On Windows, `os.homedir()` reads `USERPROFILE`, not `HOME`. The test configured
its own temporary home through `HOME`, but a legacy service-state path called
`os.homedir()` and therefore resolved under the runner's user profile. The
service path was outside the test's per-test sandbox, so the original
`startsWith(tempHome)` assertion correctly failed. Pinning `USERPROFILE` to that
test's temporary home makes the path and assertion agree.

OpenCodex's `tests/service/service-claim.test.ts` exposed this on
`windows-latest` in run 35816970127. PR #5634 sets `USERPROFILE` to the test's
temp home on win32, keeps the original raw `startsWith` assertion unchanged,
and restores the variable in `finally`.

## Workaround

For a Windows test that calls code using `os.homedir()`, set `USERPROFILE` to
that test's own temporary home and restore its previous value in `finally`:

```ts
const previous = process.env.USERPROFILE;
try {
  if (process.platform === "win32") process.env.USERPROFILE = tempHome;
  // Keep the original assertion: every state path starts with tempHome.
  await exerciseServiceClaim();
} finally {
  if (process.platform === "win32") {
    if (previous === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previous;
  }
}
```

Keep this override local to the test. Do not pin `USERPROFILE` in a shared
`createTempHome` helper when another suite relies on the shared sandbox.

Unsafe fixes:

- Widen the assertion to accept a shared sandbox such as `HOME/.opencodex`.
  That allows paths outside this test's own temporary home and weakens isolation.
- Canonicalize both paths merely to make the shared-sandbox variant pass. It
  preserves the widened boundary and therefore has the same isolation defect.
- Skip the Windows assertion or replace it with a suffix/basename check; either
  hides a path escaping the test's sandbox.
