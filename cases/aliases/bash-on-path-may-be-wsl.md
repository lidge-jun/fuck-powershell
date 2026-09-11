---
id: bash-on-path-may-be-wsl
title: "with no Git for Windows installed, the only bash on PATH is the WSL launcher: it cannot open a Windows path, and it reports success anyway"
category: aliases
versions: "both"
failure: silent
context: [agent, ci, script]
source: third-party
repro: historical
refs:
  - https://github.com/LilMGenius/win-hooks/commit/006716a3e19e0ddcabf05efae0de151b2c3b1a27
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/hooks/run.mjs
ontology:
  affects: [env-windows, shell-cmd]
  invokes: [command-where]
  caused_by: [mechanism-wsl-launcher-path-translation]
  mitigated_by: [workaround-functional-interpreter-probe, workaround-absolute-spawn]
  unsafe_fix: [workaround-blacklist-bash-by-path]
  related_to: [case:timeout-is-not-a-command-wrapper]
---

# with no Git for Windows installed, the only bash on PATH is the WSL launcher: it cannot open a Windows path, and it reports success anyway

## Symptom

Nothing. That is the entire problem.

On a machine with WSL and without Git for Windows, every script dispatched through
`bash` appears to run and does nothing. Forever. Exit status 0, no stderr, no
partial output. A health check that asserts "the hook ran" passes. A log line that
says "dispatched" is true and useless.

## Repro

Start with the part you can check anywhere, because it is what tells you whether
you are exposed at all:

```
> where bash
C:\Program Files\Git\usr\bin\bash.exe                      <- wins
C:\Users\you\AppData\Local\Microsoft\WindowsApps\bash.exe
```

Measured on this host. Git's bash is first, so nothing here is broken. Uninstall
Git for Windows, or run on a stock image, and only the second entry remains: an App
Execution Alias for the WSL launcher. On some installs the same role is played by
`%SystemRoot%\System32\bash.exe`. That machine is what this case is about.

Then the check that matters. Hand that bash a Windows path and inspect **both**
what the guest received and the exit status:

```
bash -c 'test -f "C:\Users\you\script.sh"' ; echo $LASTEXITCODE
```

Expect the path to arrive mangled — the backslashes are consumed on the way in, so
`C:\x\y` reaches the guest as `C:xy` — and expect the launcher to report success
regardless.

## Verification note

The PATH resolution order above is measured on this host. The exit-0-after-failure
behaviour is **not**: this machine has no WSL installed. That half is attributed to
win-hooks, whose `hooks/run.mjs` exists specifically to reject such a candidate and
whose cited commit is titled "reject a PATH bash that cannot read Windows paths".
Treat it as a well-sourced report rather than a local measurement.

## Cause

That binary is not a POSIX shell. It is the launcher for a Linux distribution,
which has no `C:\` — WSL reaches NT files only through `/mnt/c`. So a Windows path
handed to it cannot resolve, and the backslashes do not survive the trip in the
first place.

The damaging part is not the failure; it is the reporting. A launcher that exits 0
after the command it was given found nothing turns the **last resort** of every
"find a bash on PATH" search, on a stock machine, into a binary that swallows work
and calls it done. Every layer above it is then correct and useless.

## Workaround

A candidate interpreter counts only if it proves it can do the job. Make it confirm
it can *see* the file it is about to run before you accept it:

```js
const bashSees = (exe, target) => {
  const r = spawnSync(exe, ['-c', 'test -f "$WH_PROBE"'], {
    env: { ...process.env, WH_PROBE: toPosix(target) },
    stdio: 'ignore', windowsHide: true, timeout: 10000,
  });
  return !r.error && r.status === 0;
};
```

Two details decide whether that probe works at all:

- **Pass the path through the environment, not as `$0`.** WSL's launcher reports
  `$0` as `/bin/bash`, so a `test -f "$0"` probe passes on the very interpreter it
  exists to reject. This is the kind of detail that makes a probe look correct in
  review and fail in production.
- **Let known-good absolute paths skip the probe.** An explicit override env var and
  Git's two install locations are trustworthy, so the common path costs no
  subprocess. Only a PATH candidate has to earn it.

Decide what a rejection looks like, too: one line on stderr and exit 0. Still
fail-safe, no longer silent — which is the whole point, since silence is the bug.

## Why the path blacklist is the unsafe fix

Rejecting `System32\bash.exe` and `WindowsApps\bash.exe` by name is cheaper and
does catch this instance. It is still a path heuristic: it accepts an equally broken
bash anywhere else, and it hard-codes a list that a portable, scoop or winget
install is not on. Prefer the probe; the blacklist is a stopgap you will have to
remove later.

## Contrast

`timeout-is-not-a-command-wrapper` is the same shape one binary over: a stock
Windows executable carrying a familiar POSIX name that is not that tool, failing in
a way that reads as success. If you are resolving POSIX-named commands on Windows
by name, both cases are the same lesson — the name is not the identity.

