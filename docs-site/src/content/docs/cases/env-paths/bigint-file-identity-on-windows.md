---
title: "Bun's numeric Windows file IDs can round together and pass a replacement check"
description: "env-paths landmine — silent (both)"
sidebar:
  label: "bigint file identity on windows"
---

<p class="case-eyebrow">env paths · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#win32-file-id-number-rounding">win32-file-id-number-rounding</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">bun, windows, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">ASSERTION MISMATCH</span></div><div class="row"><span class="k">Mechanism</span><span class="v">win32 file id number rounding</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">bigint file identity</span></span></div></div>

## Symptom

A TOCTOU guard checks that a file still has the same identity between a
pre-open check and opening SQLite. On Bun 1.4.0 for Windows, the replacement
test failed intermittently: a different regular file at the path passed the
identity comparison.

The affected test was
`codex-log-guard-maintenance-coderabbit`:
`rejects a regular-file replacement between the pre-open check and SQLite open`
(windows-latest job 107059048170).

## Repro

Read a file's `dev` and `ino` with ordinary numeric stats, replace the file at
the same path, then compare the second numeric `dev` and `ino` to the first.
On Bun 1.4.0/Windows, distinct 64-bit file IDs can round to the same JavaScript
number, so the comparison can report an identity match. The CI replacement test
observed this intermittently.

## Cause

Ordinary Bun 1.4.0 stats expose Windows `dev` and `ino` as JavaScript numbers.
JavaScript numbers cannot exactly represent every 64-bit integer, so distinct
Windows file IDs can round to the same value and make an identity comparison
pass for a replacement.

NTFS tunneling can also preserve a name's creation time after that name is
deleted and recreated. `birthtime` therefore does not provide a reliable
replacement identity either.

PR #5656 switches the guard to `lstatSync(path, { bigint: true })` and fails
closed if `dev` or `ino` is missing, null, or zero.

## Workaround

Read identity fields as `bigint` and reject unknown identity values before
opening the file:

```ts
const info = lstatSync(path, { bigint: true });
if (info.dev == null || info.ino == null || info.dev === 0n || info.ino === 0n) {
  throw new Error("unknown file identity");
}
```

Do not substitute `birthtime` as identity. NTFS tunneling can retain that time
when a name is recreated, so the replacement may appear to be the original.

## Refs

- <https://github.com/lidge-jun/opencodex/pull/5656>
