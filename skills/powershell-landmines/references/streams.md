
# PS 5.1 turns native stderr into NativeCommandError

## Symptom

A native tool that merely writes progress to stderr (git, uv, npm, curl) appears to
FAIL under Windows PowerShell 5.1: red `NativeCommandError` text, or — with
`$ErrorActionPreference = 'Stop'` — the whole script terminates even though the
tool exited 0.

## Repro

```powershell
# Windows PowerShell 5.1, with strict error preference
$ErrorActionPreference = 'Stop'
uv python install 3.12 2>&1   # uv writes progress to stderr
# -> script terminates: uv's progress lines became ErrorRecord objects
```

## Cause

When 5.1 redirects a native command's stderr (`2>&1`, or captures in a variable),
each stderr line is wrapped in an `ErrorRecord` and surfaced through the error
stream. Combined with `$ErrorActionPreference='Stop'`, successful commands become
fatal errors. The hermes-agent installer hit this with uv and shipped a fix that
relaxes EAP around the native call and verifies success separately (see ref).
PowerShell 7.2+ no longer wraps native stderr this way.

## Workaround

- Do not combine `2>&1` with `Stop` preference around native commands on 5.1.
- Temporarily set `$ErrorActionPreference='Continue'` around the call, then check
  `$LASTEXITCODE`.
- The cli-jaw installer documents this exact hazard in its 5.1-safe install path.


---


# > /dev/null creates a literal file (or kills CI) on Windows

## Symptom

A cross-platform script silences output with `> /dev/null 2>&1`. On Windows the
job fails outright, or a mysterious file named `dev` (or a `\dev\null` path error)
appears. Windows-only CI lanes go red while every POSIX lane stays green.

## Repro

```powershell
cmd-that-writes-stderr 2>/dev/null
# out-file : Could not find a part of the path 'C:\dev\null'
```

## Cause

`/dev/null` is a POSIX device path. PowerShell treats it as a relative file path
under the current drive; there is no `C:\dev\null`, so redirection either errors
or creates unexpected files. The robodog project hit exactly this class of bug and
shipped an auto-translation layer converting `2>nul` / `2>/dev/null` to `2>$null`
with regression tests (see ref).

## Workaround

- PowerShell-native: redirect to `$null` (`2>$null`, `*> $null`) or pipe to
  `Out-Null`.
- Cross-platform scripts: branch on platform, or use the runtime's null device
  abstraction instead of a hardcoded path.
