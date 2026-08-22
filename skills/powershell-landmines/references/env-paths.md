
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


---


# $env:USERDOMAIN is not your identity

## Symptom

An ACL/permissions script builds a principal as `"$env:USERDOMAIN\$env:USERNAME"`
and passes it to `icacls`. It works on the dev machine, then fails on a renamed
computer, a Microsoft-account login, or an AzureAD-joined machine: icacls cannot
resolve the principal, the grant fails, and if the code fails closed, the whole
feature dies.

## Repro

```powershell
# On a workgroup (non-domain) machine:
$env:USERDOMAIN          # -> COMPUTERNAME, not a domain
# Microsoft-account login: local profile name != account name
icacls secret.txt /grant "$env:USERDOMAIN\$env:USERNAME:(R)"
# -> "No mapping between account names and security IDs was done."
```

## Cause

`USERDOMAIN` is always set — on a workgroup machine it silently holds the computer
name, so `domain ? "domain\user" : user` fallbacks never fire. Both variables are
also plain environment values, writable by whatever launched the process, which
makes them attacker-influenceable in a permissions path.

## Workaround

Use the SID, which is what the token actually carries and which icacls accepts
directly:

```powershell
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
icacls secret.txt /grant "*${sid}:(R)"
```

The referenced production fix replaced the env-derived principal with the current
token's SID for exactly the failure modes above.


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
