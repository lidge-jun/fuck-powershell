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
