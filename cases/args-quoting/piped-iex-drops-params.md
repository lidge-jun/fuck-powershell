---
id: piped-iex-drops-params
title: "irm | iex cannot pass parameters — your -Switch goes to iex, not the script"
category: args-quoting
versions: "both"
failure: silent
context: [interactive, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0851921ae0b3ab382c2546b24e5aa67b0d163b37
---

# irm | iex cannot pass parameters — your -Switch goes to iex, not the script

## Symptom

Docs advertise `irm https://x/install.ps1 | iex -SomeOption` and users report
the option does nothing — or `iex` errors about an unknown parameter. The
streamed installer always runs with defaults.

## Repro

```powershell
irm https://example.com/install.ps1 | iex -BootstrapDependencies
# Invoke-Expression : A parameter cannot be found that matches parameter name
# 'BootstrapDependencies'. (iex has no such parameter — and no way to forward one)
```

## Cause

`Invoke-Expression` evaluates a STRING. It has no mechanism to bind parameters
into the script it evaluates; anything after `iex` is an argument to iex
itself. The pipe-to-iex distribution form structurally cannot accept options.

## Workaround

- Parameterized installs must download then invoke:
  `irm url -OutFile i.ps1; powershell -File i.ps1 -SomeOption` (mind
  execution-policy-file-block).
- Or read options from env vars inside the script (`$env:INSTALL_OPTS`), which
  survive the iex form. The referenced commit removed the misleading flagged
  one-liner and pinned a contract test that iex takes no installer parameters.
