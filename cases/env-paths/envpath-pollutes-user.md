---
id: envpath-pollutes-user
title: "Appending to $env:Path and saving to User PATH copies Machine PATH in"
category: env-paths
versions: "both"
failure: silent
context: [script]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/cli-jaw/commit/f0020c663e8fe8e828053851a034377b8d0ff825
  - https://github.com/lidge-jun/cli-jaw/commit/514f9a9cd0f3d40e37578fa641c33dec9aadff37
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-setenvironmentvariable]
  caused_by: [mechanism-registry-env-snapshot]
  mitigated_by: [workaround-scope-read-path]
---

# Appending to $env:Path and saving to User PATH copies Machine PATH in

## Symptom

After an installer "adds one directory to PATH", the user's User PATH suddenly
contains the entire system PATH — duplicated. Future Machine PATH changes get
shadowed by the stale copy, and the PATH grows every time the pattern runs.

## Repro

```powershell
# The innocent-looking pattern:
[Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\tools', 'User')
# $env:Path is the MERGED Machine+User view — you just wrote all of it into User.
```

## Cause

`$env:Path` is the process-level merge of Machine and User PATH. Using it as
the base for a User-scope write permanently copies every Machine entry into the
User value. The corruption is silent and compounds across installers.

## Workaround

```powershell
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*C:\tools*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;C:\tools", 'User')
}
```

Read the specific scope, append only the missing entry. The referenced fix
replaced the merged-view guidance with exactly this scope-read pattern.
