---
id: timeout-is-not-a-command-wrapper
title: "timeout waits for a keypress instead of bounding a command, and Git's GNU timeout shadows it by PATH order"
category: aliases
versions: "both"
failure: silent
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/55
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, shell-cmd, env-windows]
  invokes: [command-start-process]
  caused_by: [mechanism-alias-shadowing, mechanism-pathext-resolution]
  mitigated_by: [workaround-native-process-deadline, workaround-kill-process-tree]
---

# timeout waits for a keypress instead of bounding a command, and Git's GNU timeout shadows it by PATH order

## Symptom

You bound a long-running command with a deadline the way you would anywhere else:

```
timeout 300 mytool run --slow
```

On Windows this does not bound anything. Depending on which `timeout` wins the PATH
search you get one of two completely different behaviours, and neither is the one
you wrote:

- `C:\Windows\System32\timeout.exe` **waits 300 seconds and then exits.** Your
  command never runs at all. The script continues as if it had.
- Git for Windows ships GNU coreutils `timeout.exe`, which does wrap the command —
  but signals the timeout with exit code 124, not the 142 a POSIX
  `128 + SIGALRM` check is looking for.

The System32 case is the dangerous one. A five-minute pause followed by "success"
reads as a slow-but-healthy step, and the work silently did not happen.

## Repro

Both are on PATH on a stock developer machine with Git installed:

```
PS> Get-Command timeout -All | Select-Object Name,Source

Name        Source
----        ------
timeout.exe C:\Program Files\Git\usr\bin\timeout.exe
timeout.exe C:\WINDOWS\system32\timeout.exe
```

Which one you get depends entirely on PATH order, and that order differs between an
interactive shell, a CI runner, and an agent harness. What System32's does:

```
PS> & "$env:SystemRoot\System32\timeout.exe" /?

TIMEOUT [/T] timeout [/NOBREAK]

Description:
    This utility accepts a timeout parameter to wait for the specified
    time period (in seconds) or until any key is pressed.
```

It takes no command. `timeout 300 mytool run` passes `300` as the wait and the rest
as arguments it ignores.

There is a second trap in it: "or until any key is pressed" means it is also
interactive. Under a redirected or non-console stdin it can fail outright with
`ERROR: Input redirection is not supported`, so the same line behaves differently
in a terminal, in CI, and under an agent.

## Cause

`timeout` is one of the handful of names where Windows shipped an unrelated utility
under a name POSIX had already spent decades assigning a meaning to. System32's is
a pause/sleep helper for batch files, roughly `sleep` with a keypress escape. GNU's
is the command wrapper. Both are called `timeout.exe`, both end up on PATH, and
PATH order decides.

The failure is silent because System32's `timeout` exits 0 after waiting. There is
no "unknown argument" complaint — surplus arguments are simply not read — so nothing
in the exit status or the output distinguishes "bounded the command" from "slept and
did nothing".

The POSIX equivalent of this mistake does not exist: there is one `timeout`, and it
takes a command.

## Workaround

Do not spell the word `timeout` in a Windows script. Use the process API, which is
always present and distinguishes the deadline from the child's own exit:

```powershell
$p = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru
if (-not $p.WaitForExit(300000)) {
  $p.Kill($true)        # $true = whole process tree
  exit 142              # keep a distinct sentinel for "deadline fired"
}
exit $p.ExitCode
```

`WaitForExit(ms)` returning `$false` is the deadline; the child's own code passes
through untouched. `Kill($true)` matters because a modern CLI is usually a launcher
with children.

If you are inside Git Bash and genuinely want GNU `timeout`, call it by full path
(`/usr/bin/timeout`) so PATH order cannot substitute the other one, and check for
124, not 142.

Do not reach for `perl -e 'alarm ...'` as the portable spelling either — see the
sibling issue about its exit code under Git's Cygwin perl.

---

`curl-alias` is the same species — a POSIX name that resolves to something else on
Windows — but there the substitute at least tries to do the job, and the failure is
loud. Here the substitute succeeds at a different job and reports success.
`command-v-noop` is the probe-side version: a check that silently answers wrong.
