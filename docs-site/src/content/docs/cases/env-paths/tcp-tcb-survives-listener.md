---
title: "the port is still busy after your server exited, because Windows keeps TCP state the dead socket left behind and SO_REUSEADDR does not clear it"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "tcp tcb survives listener"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#tcb-retention">tcb-retention</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, node, win32 api</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">tcb retention</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">delete tcb entry</span></span></div></div>

## Symptom

Your server exits cleanly and the next start cannot bind:

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:8080
```

No process holds the port. `tasklist` shows nothing, you killed the tree, the
handles are closed. Waiting a minute or two fixes it, which is the tell — and so
is the fact that a restart loop in CI fails while a human retrying by hand
succeeds.

You already set `SO_REUSEADDR` because that is what fixes this on Linux. It does
not fix it here.

## Repro

Stop a server that had a live client connection, then immediately look at what is
left:

```
C:\> netstat -ano -p tcp | findstr :8080
  TCP    127.0.0.1:8080     127.0.0.1:52144    TIME_WAIT       0
```

PID `0`: no process owns it. The row is kernel-side connection state, and a new
bind on the same local endpoint is refused while it exists.

## Cause

A closed socket does not immediately free its endpoint. The kernel keeps a
Transmission Control Block for it — `TIME_WAIT` after an active close, plus other
lingering states — so late packets from the old connection cannot be delivered to
a new one. That part is standard TCP and happens on every platform.

What differs is the escape hatch. On Linux, `SO_REUSEADDR` means "let me bind
even though a `TIME_WAIT` exists here", which is exactly the permission you want.
On Windows, `SO_REUSEADDR` means something else — roughly "let two sockets share
this endpoint" — and it does not grant the thing you were reaching for. The
POSIX-shaped fix is a no-op for the POSIX-shaped problem.

So the port stays unbindable until the state ages out, and there is no socket
option that shortens the wait.

## Workaround

Delete the leftover state explicitly. Win32 exposes it through `SetTcpEntry` with
the row's state set to `MIB_TCP_STATE_DELETE_TCB` (12), which tears down the TCB
for a specific four-tuple:

```go
// iphlpapi.dll SetTcpEntry, MIB_TCPROW{State: 12, LocalAddr, LocalPort, RemoteAddr, RemotePort}
row := mibTCPRow{State: 12, LocalAddr: local, LocalPort: lp, RemoteAddr: remote, RemotePort: rp}
setTCPEntryProc.Call(uintptr(unsafe.Pointer(&row)))
```

Two limits worth knowing before you build on it. It needs administrator rights,
and the structure is IPv4-only — there is no IPv6 equivalent that safely
represents the row, so a dual-stack listener can only ever have half its leftovers
cleared this way.

Because of those limits, the durable answer is usually to stop needing the exact
port on the next start: bind port 0 and publish the assigned port, or use a small
candidate range with fallback. That turns a hard failure into a startup detail.

If you do enumerate rows to find what to delete, read them structurally rather
than by scraping `netstat` text — that output is localized, and matching English
state words is its own trap.

---

`unlink-while-open-ebusy` is the file-handle version of "the resource outlives
the process". This is the socket version, and it is worse in one specific way:
there is no handle to close and no process to kill, so every technique that fixes
the file case does nothing here.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/37>
- <https://github.com/lidge-jun/opencodex/commit/b1713b574fea949300ff477dd3ea48fda0ada814>
