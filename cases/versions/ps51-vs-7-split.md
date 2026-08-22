---
id: ps51-vs-7-split
title: powershell.exe and pwsh are different languages wearing one syntax
category: versions
versions: "both"
failure: silent
context: [script, ci]
source: third-party
repro: verified
refs:
  - https://github.com/parsaesmaili038/ticketing-v1/commit/d5a4d513e34d557f345b41d9e1b9fdd2806d4a04
  - https://github.com/lidge-jun/cli-jaw/blob/main/scripts/install.ps1
---

# powershell.exe and pwsh are different languages wearing one syntax

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
