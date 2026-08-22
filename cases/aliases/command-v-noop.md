---
id: command-v-noop
title: "command -v silently reports every tool as missing"
category: aliases
versions: "both"
failure: silent
context: [agent, script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/ba1c157950b467719ad2d47ae9eda0c2514d67ad
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-command, command-get-command]
  caused_by: [mechanism-absent-builtin-noop]
  mitigated_by: [workaround-get-command, workaround-lastexitcode-gate]
---

# command -v silently reports every tool as missing

## Symptom

An agent (or a ported bash script) probes for a tool with `command -v foo` under
PowerShell. The probe prints nothing and the script concludes the tool is
missing — even though it is installed and on PATH. Installs get re-run,
bootstraps loop, "missing dependency" errors lie.

## Repro

```powershell
command -v git      # prints nothing, no error, $? stays true
Get-Command git     # works: CommandType Application, path shown
```

## Cause

PowerShell has no `command` builtin. Depending on parse context, `command -v git`
either matches nothing quietly or binds to unrelated tokens; it raises no error
and sets no useful exit state. The bash idiom fails in the WORST way: silently,
with a plausible-looking negative result.

## Workaround

- Probe with `Get-Command <tool> -ErrorAction SilentlyContinue` (null check) or
  simply run `<tool> --version` and check `$LASTEXITCODE`.
- Agent prompts targeting Windows must map `command -v` → `Get-Command`; the
  referenced commit ships that rule as a documented shell-hazard contract.
