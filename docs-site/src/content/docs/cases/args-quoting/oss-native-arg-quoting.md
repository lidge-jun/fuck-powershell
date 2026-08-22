---
title: "Embedded quotes and empty args vanish before native commands see them"
description: "args-quoting landmine — silent (both)"
---

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span></div>

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
- <https://github.com/PowerShell/PowerShell/pull/15408>
