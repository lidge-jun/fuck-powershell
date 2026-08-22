---
id: ps-file-extension-dispatch
title: "powershell -File refuses scripts that aren't named .ps1"
category: args-quoting
versions: "both"
failure: hard-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/0efd755ed938e13bb527105fd83500ad1001d0e6
---

# powershell -File refuses scripts that aren't named .ps1

## Symptom

A bootstrap downloads an installer script to a temp file and runs it with
`powershell -File $tmpfile`. On Windows it fails with "the file ... is not
recognized as a PowerShell script" — because the temp file was created with a
`.sh` (or extensionless) name by cross-platform code.

## Repro

```powershell
Copy-Item installer.ps1 installer.sh
powershell -File .\installer.sh
# Processing -File 'installer.sh' failed: the file does not have a '.ps1' extension.
```

## Cause

`powershell -File` / `pwsh -File` dispatch on the FILENAME EXTENSION, not the
content. Anything not ending in .ps1 is rejected before parsing. Cross-platform
download helpers that default temp suffixes to .sh silently arm this on the
Windows branch.

## Workaround

- Choose the temp suffix by target shell: `.ps1` when the launcher is
  PowerShell, `.sh` for POSIX. The referenced fix does exactly this
  (suffix = shell === 'powershell' ? 'ps1' : 'sh').
