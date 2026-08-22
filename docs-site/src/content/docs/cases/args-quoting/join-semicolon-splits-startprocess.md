---
title: "Joining command fragments with '; ' splits Start-Process mid-call"
description: "args-quoting landmine — silent (both)"
---

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">agent</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#statement-terminator">statement-terminator</a></div>

## Symptom

An elevation launcher builds one `Start-Process` invocation from string
fragments and joins them with `"; "`. The elevated process starts — but without
its arguments and without the UAC verb, so the elevated action silently does the
wrong thing (or nothing).

## Repro

```js
// Generator code building a PowerShell command line:
const cmd = ["Start-Process -FilePath 'app.exe'", "-ArgumentList 'install'", "-Verb RunAs"].join("; ");
// Produces: Start-Process -FilePath 'app.exe'; -ArgumentList 'install'; -Verb RunAs
// → Start-Process runs with NO args; the rest are separate (broken) statements.
```

## Cause

`;` is PowerShell's statement terminator. A generator that joins PARAMETER
fragments of one call with `"; "` inserts statement boundaries mid-command.
Each fragment after the first is parsed as a new statement starting with a
parameter token — a parse error at best, a silently degraded `Start-Process`
at worst.

## Workaround

- Join parameter tokens of a single call with spaces (or build an array and
  splat); place `;` only BETWEEN complete statements.
- The fix joined fragments with "" and kept `;` only after the complete
  `Start-Process ... -Wait`.

## Refs

- <https://github.com/lidge-jun/opencodex/commit/ac8c0d2dfdae12904d6ed818763bc069cdb84764>
- <https://github.com/lidge-jun/opencodex/commit/ebf947ec579a4750b261e3247aabd7a5675b3764>
