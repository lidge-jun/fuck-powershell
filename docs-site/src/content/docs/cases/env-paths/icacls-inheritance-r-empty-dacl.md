---
title: "icacls /inheritance:r before the grant leaves a file with no ACEs at all, so an interrupted hardening script locks every consumer out of a file that still says you own it"
description: "env-paths landmine — hard-error (both)"
sidebar:
  label: "icacls inheritance r empty dacl"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#acl-step-order">acl-step-order</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, powershell 51</span></div><div class="row"><span class="k">Fails as</span><span class="v">EPERM</span></div><div class="row"><span class="k">Mechanism</span><span class="v">acl step order</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">grant before restrict</span></span></div></div>

# icacls /inheritance:r before the grant leaves a file with no ACEs at all, so an interrupted hardening script locks every consumer out of a file that still says you own it

## Symptom

A hardening routine that locks down a secrets file half-runs — a timeout, a
transient failure, a killed CI job — and afterwards nothing can read it:

```
Access is denied.
```

You own it. `dir` shows it. You cannot read it and cannot delete it, and neither
can the service that needs it. Re-running the hardening script does not help,
because it starts by stripping inheritance again on a file that already has no
ACEs. Recovery exists, but it is a DIFFERENT command than the one that broke it,
and nothing in the failure tells you that.

## Repro

The dangerous order, interrupted after the first step:

```
C:\> echo secret > secret.txt
C:\> icacls secret.txt /inheritance:r
processed file: secret.txt

C:\> type secret.txt
Access is denied.

C:\> del secret.txt
Access is denied.
```

The file now has an owner and an EMPTY DACL, which is not the same as no DACL: an
empty DACL grants nothing to anyone, while a null DACL grants everything to
everyone. Every consumer is locked out, including the service the hardening was
for.

Recovery is possible because ownership carries `WRITE_DAC` — but only through a
different invocation:

```
C:\> icacls secret.txt /grant *S-1-5-32-544:(F)
C:\> icacls secret.txt /reset
```

That is the part that makes this expensive in practice: the automation cannot
self-heal by retrying, and a human has to know that `/grant` or `/reset` is the
way back in.

POSIX `chmod 000` is a fair comparison for the data access and not for the
recovery — there the owner restores the mode with the same tool they broke it
with.

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
icacls "%TARGET%" /grant *%SID%:(F)          rem 1. keep a way back in
icacls "%TARGET%" /inheritance:r             rem 2. now safe to strip
icacls "%TARGET%" /remove:g *S-1-5-32-545    rem 3. drop the rest
```

Name principals by SID rather than by `USERDOMAIN\USERNAME` — that is
`env-domain-principal`, and it matters here because a grant against the wrong
name is a grant that did not happen.

For a directory, the grant needs the inheritance flags — `(OI)(CI)(F)` — or
children created later inherit nothing.

Design the routine so that failure at any step leaves the target USABLE rather
than merely leaving it unhardened. Unhardened is a security finding you can fix on
the next run; locked-out is a support ticket.

Verify at the end rather than trusting exit codes: `icacls` reports per-file
success lines, and a partially applied ACL can still exit zero on the step that
did run.

---

`env-domain-principal` covers WHO to name in the grant — the token SID rather
than `USERDOMAIN\USERNAME`. This case is about WHEN: the identity can be perfectly
correct and the order still locks every consumer out.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/36>
- <https://github.com/lidge-jun/opencodex/commit/0e78e4d59b3df0d06e44def819d6842fe3c2515c>
