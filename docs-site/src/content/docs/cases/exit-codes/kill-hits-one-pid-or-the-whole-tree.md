---
title: "killing a child leaves its grandchildren running, and the fix for that kills the process asking for it"
description: "exit-codes landmine — silent (both)"
sidebar:
  label: "kill hits one pid or the whole tree"
---

<p class="case-eyebrow">exit codes · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#no-process-group">no-process-group</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">no process group</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">job object or scoped tree kill</span></span></div></div>

# killing a child leaves its grandchildren running, and the fix for that kills the process asking for it

## Symptom

Two failures that look unrelated and are the same missing abstraction.

**Orphans.** A timeout fires, you call `child.kill()`, the timeout handler reports
success — and the shell that child spawned is still running, still holding a port,
still writing to a file you are about to delete. Every process listing shows the
direct child gone.

**Suicide.** You switch to `taskkill /T` to fix that, and now a restart command
run from inside the tree kills ITSELF partway through. The service goes down, the
line that was supposed to start it again never executes, and nothing recovers
because the thing that would have recovered it is dead.

## Repro

Orphans:

```js
const child = spawn("cmd.exe", ["/c", "node long-running-child.js"]);
setTimeout(() => child.kill(), 1000);
// cmd.exe dies; node long-running-child.js keeps running
```

Suicide:

```
C:\> taskkill /PID <gateway-pid> /T /F
SUCCESS: ...
C:\> schtasks /Run /TN gateway      <- never reached: this shell was in the tree
```

On POSIX neither happens, because `kill(-pgid, SIGTERM)` addresses a group you
opted into and your own process is not in it unless you put it there.

## Cause

Windows has no POSIX process group. `ChildProcess.kill()` maps to
`TerminateProcess` on one PID, and `TerminateProcess` does not touch descendants,
so anything your child spawned is orphaned and reparented to nothing in
particular.

`taskkill /T` walks the parent-PID chain instead — which is the only readily
available tree operation, and it is the WRONG shape for the job. It does not know
about a group you chose; it kills whatever happens to descend from the target at
that instant. An agent's exec process is typically a descendant of the very
service being restarted, so "restart the gateway" resolves to "kill the gateway
and also me".

So the two failures are one gap: there is no cheap way to say "this set of
processes" on Windows, and both available primitives answer a different question
than the one you asked.

## Workaround

Use a Job Object, which is the actual Windows equivalent of a process group:

```
CreateJobObject -> AssignProcessToJobObject(child)
  with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
-> closing the handle kills exactly the members, and nothing else
```

Membership is explicit, so it cannot sweep up a caller that merely happens to be
downstream. In Node this needs a native addon or a helper process; several
packages wrap it.

When `taskkill /T` is what you have, break the ancestry before you use it. Spawn
the target with `DETACHED_PROCESS` or via a scheduled task so it is not your
descendant, and run the restart from outside the tree — a scheduled task, a
service control call, or a small helper the tree does not contain.

Whatever you choose, verify termination rather than trusting the call: check that
the PIDs are gone and that the port is free before reporting success. Both
failures above reported success.

---

`unlink-while-open-ebusy` is what the orphan does to you afterwards — a surviving
grandchild holds a file and your cleanup fails with EBUSY.
`startup-artifact-is-not-a-process` is the reporting half: no supervisor is
tracking any of this, so the state you display is whatever you inferred.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/50>
- <https://github.com/openclaw/openclaw/issues/111900>
- <https://github.com/openclaw/openclaw/issues/120134>
- <https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill>
- <https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information>
