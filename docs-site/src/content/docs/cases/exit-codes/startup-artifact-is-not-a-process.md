---
title: "Windows autostart has no supervisor, so a registered Startup entry reports the service as running when nothing is"
description: "exit-codes landmine — silent (both)"
sidebar:
  label: "startup artifact is not a process"
---

<p class="case-eyebrow">exit codes · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#exit-code-propagation">exit-code-propagation</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, cmd</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">exit code propagation</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">pidfile ownership</span></span></div></div>

## Symptom

You port a background service from launchd or systemd to Windows. `status` says
loaded, `stop` says stopped, and both are lies. The dashboard is green while the
process is dead; the stop command returns success while the process keeps running.

On the POSIX side you never wrote this bug, because you asked the supervisor and
the supervisor knew.

## Repro

A Startup-folder entry has no run-state at all:

```powershell
PS> $startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
PS> Copy-Item app.cmd $startup
PS> Test-Path "$startup\app.cmd"
True                                  # true forever, whether or not it ever ran
```

A Scheduled Task does have state, and that is the subtler half — it reports the
TASK HOST, not the thing the host launched:

```powershell
PS> schtasks /Query /TN MyApp /FO LIST /V | Select-String "Status|Last Result"
Status:            Ready
Last Result:       0
```

`Ready` means "not currently executing the action"; `Last Result: 0` means the
action it launched returned success. Your detached server started, the launcher
returned 0, and the task went back to Ready. That reads identically whether the
server is serving or died ninety seconds later.

## Cause

launchd and systemd are supervisors: they own the process, so "is it loaded" and
"is it running" are the same question and they answer it authoritatively.

Windows autostart mechanisms are not supervisors. A Startup-folder `.cmd` is a
file Explorer executes once at logon and then forgets entirely.

A Scheduled Task is closer but still not one. It tracks its own execution — the
API exposes `TASK_STATE_RUNNING` and the CLI shows Status and Last Result — and
that state is about the task instance. The moment your action detaches a server
and returns, the task is done and its state stops describing your process. So the
question "is the task registered" has an answer, "is the task running" has an
answer, and "is my daemon alive" has none.

Neither owns your process, so registration and liveness are independent facts, and
code ported from a supervisor platform reads the one it can get as the one it
wants.

The tempting fallback makes it worse. Probing your own HTTP health endpoint is
unattributable: if your process died and a foreign one bound the port, the health
check answers 200 and you report healthy about someone else's server.

## Workaround

Derive liveness from a pidfile you own and verify, and keep it separate from
registration:

```
registered = the Startup entry or Scheduled Task exists
running    = pidfile exists AND that pid is alive AND it is ours
```

"It is ours" needs a real check — the pid must still be alive and its identity
must match what you recorded (start time, launch fingerprint, or a token the
process wrote), because pids are reused. Write the pidfile from inside the
process, not from the launcher.

After starting, poll for ownership to appear rather than asserting success; the
launcher returning 0 only means the launch was requested. Report the two states
separately in your UI, since "registered but not running" is a real and
diagnosable condition on Windows in a way it is not under a supervisor.

---

The corpus's other exit-code cases are about a command's own status being lost or
faked. This one is about a status nobody is tracking at all: there is no process
supervisor to ask, so any code that assumes one invents an answer.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/25>
- <https://github.com/lidge-jun/cli-jaw/commit/955d2b3f7bbac00874a73a07d130bc09bcf0ec93>
