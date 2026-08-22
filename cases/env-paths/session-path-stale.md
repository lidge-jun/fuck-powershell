---
id: session-path-stale
title: "Installed a tool, still 'not found' — your session's PATH is a snapshot"
category: env-paths
versions: "both"
failure: misleading-error
context: [script, interactive, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/ima2-gen/commit/1442bd1fa555ebda0db9b2a4a86f48ab504fd122
---

# Installed a tool, still 'not found' — your session's PATH is a snapshot

## Symptom

An installer runs `winget install node` (or similar), the install succeeds, and
the very next line — `node --version` — fails with "not recognized". The user
opens a NEW terminal and it works. Agents retry the install in a loop.

## Repro

```powershell
winget install OpenJS.NodeJS ; node --version
# 'node' is not recognized as the name of a cmdlet...
# New terminal: node --version → works.
```

## Cause

Installers write PATH to the REGISTRY (Machine/User scope). `$env:Path` is a
process-creation snapshot of that merge — it never refreshes itself. Everything
the current session spawns inherits the stale copy, so the just-installed tool
is invisible until a new process re-reads the registry.

## Workaround

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')
```

Re-merge from the registry after any install step (the referenced installer does
exactly this between winget and the first node call). Scope-read before writing,
per envpath-pollutes-user — the two traps are mirror images.
