
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


---


# curl silently becomes Invoke-WebRequest

## Symptom

A script or coding agent runs `curl -s -o out.json https://api.example.com` under
Windows PowerShell and gets a parameter-binding error, a prompt hanging on input, or
an HTML-ish object instead of a file. The error mentions `Invoke-WebRequest`
parameters, not curl — which sends you debugging the wrong tool.

## Repro

```powershell
# Windows PowerShell 5.1
Get-Command curl          # -> Alias  curl -> Invoke-WebRequest
curl -s https://example.com
# Invoke-WebRequest : Parameter cannot be processed because the parameter name 's'
# is ambiguous. Possible matches include: -SessionVariable -SkipCertificateCheck ...
```

Observed live: an AI agent driving a Slack integration issued `curl` for an API
round-trip; PowerShell resolved the alias, the flags bound to Invoke-WebRequest
parameters, and the call failed with an error that pointed nowhere near the cause.

## Cause

Windows PowerShell 5.1 ships `curl` and `wget` as built-in aliases for
`Invoke-WebRequest`. An upstream attempt to remove them (PR #1901) was closed
unmerged for compatibility; 5.1 keeps the aliases forever. PowerShell 7 removed
them on all platforms, so the same command behaves differently across versions.

## Workaround

- Call `curl.exe` explicitly — the `.exe` suffix bypasses alias resolution.
- Or use `Invoke-RestMethod`/`Invoke-WebRequest` with native parameters on purpose.
- Agent system prompts targeting Windows should ban bare `curl`/`wget`.


---


# Get-Command and where.exe disagree about which npm exists, and both hand you an unrunnable path

## Symptom

You ask PowerShell where a tool lives, spawn what it tells you, and get an error
code you have never seen. Ask a *different* resolver and you get a different
path, which fails a different way. Neither answer is runnable.

```
Get-Command npm  ->  C:\Program Files\nodejs\npm.ps1   ->  spawn EFTYPE
where.exe npm    ->  C:\Program Files\nodejs\npm       ->  spawn ENOENT
```

Meanwhile `npm --version` typed into the same prompt works perfectly.

## Repro

```powershell
(Get-Command npm).Source          # C:\Program Files\nodejs\npm.ps1
(Get-Command npm).CommandType     # ExternalScript

where.exe npm
# C:\Program Files\nodejs\npm
# C:\Program Files\nodejs\npm.cmd
```

The two resolvers do not even agree on which files **exist**:

```powershell
Get-Command npm -All | ForEach-Object { $_.CommandType.ToString() + " -> " + $_.Source }
# ExternalScript -> ...\npm.ps1     <- where.exe never lists this
# Application    -> ...\npm.cmd
# Application    -> ...\npm
```

`Get-Command` ranks `.ps1` **first** and `where.exe` omits it **entirely**, because
one enumerates PowerShell command types and the other walks PATHEXT. Whichever
one your detection code calls determines which way you fail.

## Cause

### Spawn results for all three candidates

| what resolved it | path | `spawnSync` result |
|---|---|---|
| `Get-Command` (rank 1) | `npm.ps1` | **EFTYPE** |
| `where.exe` (rank 1) | `npm` (extensionless) | **ENOENT** |
| neither, by hand | `npm.cmd` | works — see below |

`EFTYPE` is the interesting one: it is not in most people's mental error table,
so it reads as "corrupt binary" rather than "this is a script that needs an
interpreter". The extensionless file is a POSIX `sh` script, hence `ENOENT` from
`CreateProcess`.

### The `.cmd` path has one more trap

Picking `.cmd` is correct, but the obvious ComSpec invocation still fails when
the path contains a space:

```js
spawnSync(process.env.ComSpec, ["/d","/s","/c", `"${target}" --version`],
          { windowsVerbatimArguments: true });
// exit 1
// stderr: 'C:\Program' is not recognized as an internal or external command
```

`cmd /s /c` strips the **outer** pair of quotes from the entire command line, so
your quotes around the path are the ones removed. Wrap twice:

```js
spawnSync(process.env.ComSpec, ["/d","/s","/c", `""${target}" --version"`],
          { windowsVerbatimArguments: true });
// exit 0
// stdout: 10.9.2
```

## Workaround

```powershell
# ask for Application only, and prefer .cmd/.exe explicitly
Get-Command npm -All |
  Where-Object { $_.CommandType -eq 'Application' -and $_.Source -like '*.cmd' } |
  Select-Object -First 1 -ExpandProperty Source
```

In spawn logic: never trust rank 1 from either resolver. Enumerate all
candidates, filter to `.exe` then `.cmd`, reject `.ps1` and extensionless, and
double-quote the ComSpec command line.

---

`npm-ps1-not-comspec` establishes that the `.ps1` shim wins the PATH race and
cannot be launched. This case adds the part that makes it hard to diagnose: the
two resolvers you would use to investigate **disagree about which files exist**,
so the tool you reach for decides which error you see. It also records `EFTYPE`
as the concrete spawn code, and the `cmd /s /c` double-quoting requirement, none
of which appear in the archive.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14,
npm 10.9.2.


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


---


# bare npm is ENOENT and npm.cmd is EINVAL - the same tool, two different lies

## Symptom

Any Node program that spawns a package-manager CLI dies on Windows, and the two
obvious spellings fail with two *different* errors, which sends you down two
different wrong paths:

```
spawnSync npm ENOENT
spawnSync npm.cmd EINVAL
```

`ENOENT` reads as "npm is not installed" and `EINVAL` reads as "bad arguments".
Neither is true. npm works fine from the same shell.

## Repro

```js
const { spawnSync } = require("node:child_process");
spawnSync("npm", ["--version"], { encoding: "utf8" }).error.code;     // ENOENT
spawnSync("npm.cmd", ["--version"], { encoding: "utf8" }).error.code; // EINVAL
```

Verified on Windows 11, Node 22.14 and 24.19.

## Cause

Two unrelated facts stacked:

1. There is no file named `npm` on disk. PATHEXT resolution is a *shell*
   behavior, and `spawnSync` without `shell: true` does not perform it, so the
   bare name genuinely does not exist -> `ENOENT`.
2. `npm.cmd` does exist, but Node refuses to spawn `.cmd`/`.bat` shell-less
   after the CVE-2024-27980 hardening -> `EINVAL`.

So the correct-looking fix for the first error walks straight into the second.

## Why `shell: true` is not the answer

It is the first thing everyone reaches for, and it is a security regression when
the command is user-supplied: Node does not escape cmd metacharacters in that
mode, so an argument containing `&` or `^` becomes command injection. This repo's
own `oss-native-arg-quoting` case is the same wound from the other side.

## Workaround

Resolve the command yourself, then route by extension:

```js
// PATH x PATHEXT walk -> absolute path
// .exe  -> spawn directly
// .cmd/.bat -> cmd.exe /d /s /c "<caret-escaped line>" with
//             windowsVerbatimArguments: true
```

Prefer `.exe` over `.cmd`, and never `.ps1` (see `npm-ps1-not-comspec`).

---

`npm-ps1-not-comspec` covers the `.ps1` shim winning the PATH race. This is the
adjacent trap: the `.cmd` shim is the one you are *told* to prefer, and Node
refuses it too. Worth its own entry because the fix is different (an escaped
ComSpec hop, not a preference reorder) and the error pair is what people search.

## Real-world hit

lidge-jun/codexclaw#40 — `cxc receipt test -- npm test` could not run on Windows,
which blocked the documented path to close a work phase.
Fix: https://github.com/lidge-jun/codexclaw/commit/5c03acb


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
