---
id: npm-ps1-not-comspec
title: "npm's .ps1 shim wins the PATH race and nothing can run it"
category: aliases
versions: "both"
failure: hard-error
context: [script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/380e26346e1b90824937ee409c4ddf40c1d57102
ontology:
  affects: [runtime-node, shell-powershell-51, shell-pwsh-7, shell-cmd, env-windows]
  invokes: [command-npm, command-get-command]
  manifests_as: [error-pssecurityexception]
  caused_by: [mechanism-pathext-resolution, mechanism-execution-policy-gate]
  mitigated_by: [workaround-get-command]
---

# npm's .ps1 shim wins the PATH race and nothing can run it

## Symptom

Tool detection finds "npm" but every attempt to execute it fails: cmd.exe says
it can't run the file, spawn calls error out, or execution policy blocks it.
Meanwhile `npm.cmd` sits right next to it, working fine.

## Repro

```powershell
# npm installs THREE shims side by side: npm, npm.cmd, npm.ps1
Get-Command npm     # PowerShell may resolve npm.ps1 first
# cmd.exe /c npm.ps1  → not executable via ComSpec
# Restricted policy   → npm.ps1 blocked entirely
```

## Cause

npm ships `tool`, `tool.cmd`, and `tool.ps1` shims. `Get-Command` and PATHEXT
resolution can select the `.ps1`, which (a) execution policy may block, (b)
cmd.exe/ComSpec cannot execute, and (c) CreateProcess cannot launch directly.
The extensionless file is a POSIX sh script — equally unrunnable natively.

## Workaround

- Resolve explicitly in preference order `.exe` > `.cmd`, never `.ps1`:
  `Resolve-CommandPath @('npm.cmd','npm.exe','npm')` or
  `Get-Command npm -CommandType Application`.
- In spawn logic, treat `.ps1` as non-launchable (needs an interpreter);
  the referenced fix rejects it even when PATHEXT lists it.
