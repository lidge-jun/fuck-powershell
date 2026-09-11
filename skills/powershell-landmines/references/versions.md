---
id: ps51-no-and-and
title: "PowerShell 5.1 has no && or || — agents loop on parser errors"
category: versions
versions: "5.1"
failure: hard-error
context: [agent, interactive, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/opencodex/commit/d44e5673529e25118f2dd4fef6f396b5612f140d
ontology:
  affects: [shell-powershell-51]
  manifests_as: [error-parsererror]
  caused_by: [mechanism-pipeline-chain-ops]
  mitigated_by: [workaround-lastexitcode-gate]
---

# PowerShell 5.1 has no && or || — agents loop on parser errors

## Symptom

An AI agent (or a developer used to bash/pwsh 7) runs `build.cmd && deploy.cmd`
in Windows PowerShell 5.1 and gets "The token '&&' is not a valid statement
separator in this version." Agents told to "retry" replay the same line and loop
forever on the identical parser error.

## Repro

```powershell
# Windows PowerShell 5.1
echo a && echo b
# ParserError: The token '&&' is not a valid statement separator in this version.
# pwsh 7: works (pipeline-chain operators were added in PowerShell 7).
```

## Cause

Pipeline-chain operators `&&`/`||` shipped in PowerShell 7. 5.1 treats them as
parser errors. The trap compounds for agents: `;` is NOT a substitute (it runs
the next statement unconditionally, losing the failure gate), and bash habits
like `cd /d` or heredocs also die in PS.

## Workaround

- Gate conditionally: `command1; if ($?) { command2 }` — or check
  `$LASTEXITCODE` for native commands.
- Agent system prompts targeting Windows hosts must ban `&&`/`||` for 5.1 and
  map POSIX recovery commands (cat/ls/grep) to PS equivalents
  (Get-Content/Get-ChildItem/Select-String). The referenced fix ships exactly
  that guidance into an agent bridge.


---

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
  - https://github.com/lidge-jun/cli-jaw/commit/322ac1801a5f7422792e690c5f8dcec87425a50b
  - https://github.com/lidge-jun/cli-jaw/commit/dccabcd055a6a8d258487ae01512ad508161dd63
  - https://github.com/lidge-jun/cli-jaw/blob/main/scripts/install.ps1
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-actions-runner, env-windows, env-korean-codepage]
  invokes: [command-set-content]
  manifests_as: [error-parameterbinding, error-mojibake]
  caused_by: [mechanism-default-encoding, mechanism-alias-shadowing]
  mitigated_by: [workaround-set-content-utf8nobom, workaround-pin-ps-version]
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


---

---
id: strictmode-missing-property
title: "Set-StrictMode turns missing JSON fields into crashes"
category: versions
versions: "both"
failure: hard-error
context: [script, ci]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/5fe703a73b78eab4a0e0bff1b9c0368d0d6018ad
ontology:
  affects: [shell-powershell-51, shell-pwsh-7]
  invokes: [command-set-strictmode, command-convertfrom-json]
  manifests_as: [error-propertynotfound]
  caused_by: [mechanism-strictmode-contract]
  mitigated_by: [workaround-psobject-probe]
---

# Set-StrictMode turns missing JSON fields into crashes

## Symptom

A script parses a JSON manifest and reads optional fields (`$entry.tag`,
`$entry.artifacts.$arch`). It works for months — then dies with
PropertyNotFoundException the first time a manifest omits an optional field,
because the script also sets `Set-StrictMode -Version Latest`.

## Repro

```powershell
Set-StrictMode -Version Latest
$entry = '{"name":"x"}' | ConvertFrom-Json
$entry.tag
# PropertyNotFoundException — without StrictMode this quietly yields $null
```

## Cause

StrictMode changes the CONTRACT of property access: missing note-properties go
from "$null" to "throw". Optional-field patterns written under default mode
become latent crashes when someone adds StrictMode later (usually to catch the
dq-regex class of bug — the two traps travel together).

## Workaround

```powershell
if ($entry.PSObject.Properties.Name -contains 'tag') { $entry.tag }
```

Probe `PSObject.Properties.Name` before dereferencing optional fields; the
referenced fix wraps every optional manifest access this way.
