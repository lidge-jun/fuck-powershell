---
id: cmd-unc-cwd-not-supported
title: "cmd.exe refuses a UNC working directory, so every .cmd shim breaks when your terminal is opened inside a WSL or network path"
category: env-paths
versions: "both"
failure: misleading-error
context: [interactive, script, ci]
source: third-party
repro: historical
refs:
  - https://github.com/openclaw/openclaw/commit/684a9b2e
  - https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  manifests_as: [error-enoent]
  caused_by: [mechanism-unc-cwd-unsupported]
  mitigated_by: [workaround-run-shims-from-local-dir]
---

# cmd.exe refuses a UNC working directory, so every .cmd shim breaks when your terminal is opened inside a WSL or network path

## Symptom

An install or a build fails before it does anything, with a warning about the
current directory rather than about your command:

```
'\\wsl.localhost\Ubuntu\home\me\project'
CMD.EXE was started with the above path as the current directory.
UNC paths are not supported.  Defaulting to Windows directory.
```

Then whatever followed runs in `C:\Windows` and cannot find your project. The
realistic trigger is not a network share — it is opening a terminal inside a WSL
directory, or launching a task from an editor whose workspace lives there.

What makes it confusing is that the command itself is fine. `npm`, `yarn`, and
`corepack` are all `.cmd` shims, so any of them hops through cmd.exe and inherits
the refusal, while the same command run from `C:\` works perfectly.

## Repro

```
C:\> pushd \\wsl.localhost\Ubuntu\home\me
C:\> cmd /c npm --version
'\\wsl.localhost\Ubuntu\home\me'
CMD.EXE was started with the above path as the current directory.
UNC paths are not supported.  Defaulting to Windows directory.
```

PowerShell has no such limitation and will happily sit in that directory, which is
why the failure appears only for the subset of tools that shell out through
cmd.exe.

## Cause

cmd.exe cannot hold a UNC path as its current directory. The limitation is
historical — the current directory is a drive-relative concept in its model, and a
UNC path has no drive — and it has never been lifted. When cmd.exe starts in one,
it prints the warning and silently relocates to the Windows directory rather than
failing outright.

That silent relocation is the whole problem. The process keeps going with a
working directory nobody chose, so downstream failures are about missing files
rather than about the directory, and the warning that explains it scrolls past
above the real error.

POSIX has no equivalent: a network mount is an ordinary path, and a shell can
chdir into it like anywhere else. So code that shells out through a `.cmd` shim
picks this up on Windows only, and only for users whose project lives on a UNC
path — which increasingly means anyone working in WSL from a Windows terminal.

## Workaround

Run the shim from a local directory and pass absolute paths:

```powershell
Push-Location -LiteralPath $env:TEMP     # any drive-backed directory
try   { & $CommandPath @Arguments }      # shim now starts on a real drive
finally { Pop-Location }
```

The arguments still name the UNC location, which is fine — cmd.exe objects to
being IN one, not to being handed one.

The other durable answer is to map the UNC path to a drive letter with
`net use` or `pushd` (which does it automatically and cleans up on `popd`), so
the working directory is drive-backed for everything downstream.

Do not silence the warning without fixing the directory. The relocation happens
either way, and the message is the only clue about why your build cannot see its
own files.

---

`wsl-unc-rejects-nt-acl` is the other half of the WSL UNC story: there a security
operation has nothing to act on. Here the path is refused as a working directory
by one specific shell, and everything that hops through that shell inherits it.
