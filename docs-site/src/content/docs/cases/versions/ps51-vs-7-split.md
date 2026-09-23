---
title: "powershell.exe and pwsh are different languages wearing one syntax"
description: "versions landmine — silent (both)"
sidebar:
  label: "PS 5.1 vs 7 split"
---

<p class="case-eyebrow">versions · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">script</span><span class="badge badge-context">ci</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#default-encoding">default-encoding</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#alias-shadowing">alias-shadowing</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, actions runner, windows, korean codepage</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARAMETERBINDING, MOJIBAKE</span></div><div class="row"><span class="k">Mechanism</span><span class="v">default encoding, alias shadowing</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">set content utf8nobom</span></span></div></div>

## Symptom

A script works in local testing but breaks in CI (or vice versa): encoding
parameters do not exist, aliases behave differently, stderr handling changes,
Unicode corrupts. Nothing in the script changed — only which PowerShell ran it.

## Repro

```powershell
# pwsh 7: works
Set-Content -Path out.txt -Value "한글" -Encoding utf8NoBOM
# Windows PowerShell 5.1: parameter does not exist
# Set-Content : Cannot bind parameter 'Encoding' ... "utf8NoBOM"
```

GitHub Actions `shell: powershell` selects 5.1; `shell: pwsh` selects 7. The
referenced CI fix migrated a Windows workflow from `powershell` to `pwsh` and to
`utf8NoBOM` explicitly because Unicode was corrupting in the 5.1 lane.

## Cause

Windows PowerShell 5.1 (.NET Framework) and PowerShell 7 (.NET) diverge in
encodings (default code page + BOM vs UTF-8), aliases (curl/wget), native stderr
handling, and available parameters. Scripts that "target PowerShell" without
pinning a version target two runtimes at once.

## Workaround

- Declare the floor: `#Requires -Version 5.1` and test both runtimes in CI when
  you must support both (the cli-jaw installer CI runs 5.1 and 7 lanes).
- In GitHub Actions, choose `shell: pwsh` deliberately, not by default.
- Gate 7-only parameters behind `$PSVersionTable.PSVersion.Major` checks.

## Refs

- <https://github.com/parsaesmaili038/ticketing-v1/commit/d5a4d513e34d557f345b41d9e1b9fdd2806d4a04>
- <https://github.com/lidge-jun/cli-jaw/commit/322ac1801a5f7422792e690c5f8dcec87425a50b>
- <https://github.com/lidge-jun/cli-jaw/commit/dccabcd055a6a8d258487ae01512ad508161dd63>
- <https://github.com/lidge-jun/cli-jaw/blob/main/scripts/install.ps1>
