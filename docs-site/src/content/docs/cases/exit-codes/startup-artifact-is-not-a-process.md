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

Register a Startup-folder autostart and then ask the same question two ways:

```powershell
PS> Copy-Item app.cmd "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"
PS> Test-Path "$env:APPDATA\...\Startup\app.cmd"   # True — forever, even if the app never starts
PS> Get-Process app -ErrorAction SilentlyContinue     # nothing
```

And with a scheduled task, the same shape:

```powershell
PS> schtasks /Query /TN MyApp /XML | Select-String "<Enabled>"
<Enabled>true</Enabled>          # registration state, not run state
```

## Cause

launchd and systemd are supervisors: they own the process, so "is it loaded" and
"is it running" are the same question and they answer it authoritatively.

Windows autostart mechanisms are not supervisors. A Startup-folder `.cmd` is a
file that Explorer executes once at logon and then forgets. A Scheduled Task
records a trigger and its own last-run result, not the liveness of whatever it
launched. Neither owns your process, so registration and execution are independent
facts — and code ported from a supervisor platform reads one as the other.

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

- <https://github.com/lidge-jun/cli-jaw/commit/955d2b3f7bbac00874a73a07d130bc09bcf0ec93>
