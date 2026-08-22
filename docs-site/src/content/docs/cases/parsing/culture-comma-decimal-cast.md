---
title: "casting a comma-decimal string gives a number 100x too large, with no error"
description: "parsing landmine — silent (both)"
sidebar:
  label: "culture comma decimal cast"
---

<p class="case-eyebrow">parsing · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#culture-parsing">culture-parsing</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">culture parsing</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">numberstyles float</span></span></div></div>

## Symptom

A European-formatted decimal casts to a number **one hundred times too large**,
with no error and no warning.

```powershell
[double]"3,14"        # 314
[double]"3,14159"     # 314159        <- off by a factor of 100,000
```

This is not a parse failure that you can catch. It is a successful parse of a
different number.

## Repro

```powershell
[double]"1,5"         # 15
[double]"1,50"        # 150
[double]"1,500"       # 1500
[int]"1,234"          # 1234
[decimal]"2,5"        # 25
```

Every numeric type does it. Note `"1,500"` -> `1500` is *correct* under the
thousands-separator reading, which is exactly why the behaviour exists — and
exactly why `"1,5"` -> `15` sails through the same code path.

## Cause

PowerShell's numeric casts accept group separators. Under `en-US`, `,` is the
thousands separator, so `"3,14"` is read as "three thousand fourteen with a
stray grouping" and normalized to `314`.

Any locale that writes decimals with a comma — most of Europe, much of South
America — produces data that this reads as a different magnitude. CSV exports,
API responses from localized services, and user input are all common sources.

## `InvariantCulture` does not save you

The instinct is to reach for an explicit culture. It does not help:

```powershell
[double]::Parse("3,14", [System.Globalization.CultureInfo]::InvariantCulture)
# 314        <- still wrong, still no exception
```

`InvariantCulture` uses `.` for decimals and `,` for grouping, so it agrees
with the wrong reading. Picking a culture changes *which* separator means what;
it does not make the parse strict.

## Workaround

The only reliable fix is to reject group separators explicitly, via a
`NumberStyles` that excludes `AllowThousands`:

```powershell
[double]::Parse("3.14",
                [System.Globalization.NumberStyles]::Float,
                [System.Globalization.CultureInfo]::InvariantCulture)
# 3.14
```

`NumberStyles::Float` is `AllowLeadingWhite | AllowTrailingWhite | AllowLeadingSign |
AllowDecimalPoint | AllowExponent` — notably **without** `AllowThousands`, so a
comma now throws instead of being absorbed.

Practical rules:

- Validate the *string* before casting when it comes from data:
  `if ($s -notmatch '^-?\d+(\.\d+)?$') { throw }`
- Never use `[double]$x` on untrusted input.
- If you must accept both conventions, decide explicitly which one the source
  uses rather than letting the cast guess.

## Why this is worth filing

Nothing in the archive covers culture or numeric parsing. And unlike most
entries here, the damage is **numerically plausible** — `314` looks like a real
measurement, so it flows through validation, gets stored, and shows up as a
quantity, price or threshold that is wrong by orders of magnitude.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, culture
`en-US`. The behaviour is separator-driven, not host-locale-driven — an en-US
host mangles comma-decimal data exactly as shown above.

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/18>
