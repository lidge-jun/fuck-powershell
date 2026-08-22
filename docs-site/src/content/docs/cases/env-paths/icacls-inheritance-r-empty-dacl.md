---
title: "icacls /inheritance:r before the grant leaves a file with no ACEs at all, and you cannot repair it because repairing needs access you just removed"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "icacls inheritance r empty dacl"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#acl-step-order">acl-step-order</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, powershell 51</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">acl step order</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">grant before restrict</span></span></div></div>

## Symptom

A hardening routine that locks down a secrets file half-runs — a timeout, a
transient failure, a killed CI job — and afterwards nobody can touch the file:

```
Access is denied.
```

You own it. `dir` shows it. You cannot read it, cannot delete it, and cannot
re-run the hardening script, because that script's first act is another
`icacls` call and `icacls` needs access too. The state is not recoverable by
retrying, which is what makes it worse than a plain failure.

## Repro

The dangerous order, interrupted after the first step:

```
C:\> icacls secret.txt /inheritance:r
processed file: secret.txt

C:\> type secret.txt
Access is denied.

C:\> del secret.txt
Access is denied.
```

The file now has an owner and an empty DACL. On POSIX, `chmod 000` looks similar
and is not: the owner can always `chmod` it back, because ownership carries the
right to change the mode.

Recovery on Windows needs an ownership-based repair, which is a different command
than the one that broke it:

```
C:\> icacls secret.txt /grant "%USERNAME%":(F)
```

That works only because `WRITE_DAC` is implied by ownership — but any script that
assumed it could just re-run its hardening sequence is stuck.

## Cause

`/inheritance:r` removes inherited ACEs IMMEDIATELY, and it does not care that
the explicit ACEs meant to replace them do not exist yet. Between that call and
the grant that follows, the file's DACL is empty — and an empty DACL is not
"default permissions", it is "deny everyone".

POSIX intuition breaks in two places here. First, ownership does not imply read
access on Windows the way it effectively does under a POSIX mode. Second, there is
no single atomic operation that says "these are the permissions now"; `icacls` is
a sequence of mutations, and every gap between them is a state a crash can leave
you in.

So the ordering is not a style preference. Restrict-then-grant has a window where
failure is unrecoverable by the same tool; grant-then-restrict does not.

## Workaround

Grant first, restrict second, and treat the sequence as one that can be
interrupted at any point:

```
icacls "%TARGET%" /grant "%USERNAME%":(F)          rem 1. keep a way back in
icacls "%TARGET%" /inheritance:r                   rem 2. now safe to strip
icacls "%TARGET%" /remove:g "BUILTIN\Users"        rem 3. drop the rest
```

For a directory, the grant needs the inheritance flags — `(OI)(CI)(F)` — or
children created later inherit nothing.

Design the routine so that failure at any step leaves the target USABLE rather
than merely leaving it unhardened. Unhardened is a security finding you can fix on
the next run; locked-out is a support ticket.

Verify at the end rather than trusting exit codes: `icacls` reports per-file
success lines, and a partially applied ACL can still exit zero on the step that
did run.

---

`env-domain-principal` covers who to name in the grant — the token SID rather
than `USERDOMAIN\USERNAME`. This case is about when to name them: the identity can
be perfectly correct and the order still locks you out.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/36>
- <https://github.com/lidge-jun/opencodex/commit/0e78e4d59b3df0d06e44def819d6842fe3c2515c>
