---
title: "Embedded quotes and empty args vanish before native commands see them"
description: "args-quoting landmine — silent (both)"
sidebar:
  label: "oss native arg quoting"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#native-argv-rebuild">native-argv-rebuild</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">node, powershell 51, pwsh 7, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">silent</span></div><div class="row"><span class="k">Mechanism</span><span class="v">native argv rebuild</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">ps native argument passing</span></span></div></div>

# Embedded quotes and empty args vanish before native commands see them

## Symptom

A native command receives mangled arguments: embedded double quotes are stripped,
empty-string arguments disappear entirely, JSON payloads arrive corrupted. The
PowerShell side looks correct; only the receiving program sees the damage.

## Repro

```powershell
node -e "console.log(JSON.stringify(process.argv.slice(1)))" '{"key": "value"}' ""
# Legacy argument passing: quotes stripped, empty arg dropped:
# ["{key: value}"]
```

## Cause

PowerShell historically rebuilt a command line string for native processes instead
of passing an argument vector, re-quoting by heuristic. PR #14692 introduced
`$PSNativeCommandArgumentPassing = 'Standard'` (7.2+) using .NET ArgumentList to
fix quotes/empty/space handling — and PR #15408 immediately had to carve out a
Windows legacy mode because some Windows CLIs (msiexec-style `KEY="value"`)
depended on the broken behavior. The trap is version- and platform-dependent.

## Workaround

- Pin behavior explicitly on 7.2+: `$PSNativeCommandArgumentPassing = 'Standard'`
  (or `'Legacy'` when a Windows CLI needs it).
- Pass complex payloads via files or stdin, never inline JSON arguments, when 5.1
  must be supported.
- Test argument round-trips on every runtime you claim to support.

## Refs

- <https://github.com/PowerShell/PowerShell/pull/14692>
- <https://github.com/lidge-jun/cli-jaw/commit/77153112420acaadd961defc6a2b9a170ee70d43>
- <https://github.com/PowerShell/PowerShell/pull/15408>
