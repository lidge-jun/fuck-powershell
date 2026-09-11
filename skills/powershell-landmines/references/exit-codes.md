
# $? lies about native commands; check $LASTEXITCODE

## Symptom

A pipeline keeps going after a native command failed. CI stays green while the
build inside it broke. Nothing threw, nothing stopped — the failure was simply
never observed.

## Repro

```powershell
git clone https://example.invalid/nope.git
if ($?) { "looks fine" }        # may print despite the failure in some shapes
"exit was: $LASTEXITCODE"       # 128 — the only honest signal
deploy-something                 # runs anyway
```

## Cause

PowerShell's error machinery (`$?`, try/catch, `$ErrorActionPreference`) is built
around cmdlets and ErrorRecords. Native commands communicate failure through exit
codes, which PowerShell before 7.4's `PSNativeCommandUseErrorActionPreference`
ignores by default. Even PowerShell's own tooling had this class of bug: the .NET
global tool wrapper failed to propagate the native return code until PR #10461
fixed it.

## Workaround

- After every native command that matters: `if ($LASTEXITCODE -ne 0) { throw ... }`.
- PowerShell 7.4+: set `$PSNativeCommandUseErrorActionPreference = $true`.
- In CI steps, prefer explicit exit-code checks over trusting the step to fail.


---


# explorer.exe returns 1 on success — your spawn wrapper calls it failure

## Symptom

"Reveal in folder" works — Explorer opens with the file selected — but the app
logs an error every time, because execFileSync threw on a non-zero exit code.

## Repro

```js
execFileSync("explorer.exe", ["/select,", "C:\\file.txt"]);
// throws: exit code 1 — yet the window opened correctly
```

## Cause

explorer.exe exits 1 even on success (it hands off to the running shell process
and returns immediately). Exit-code-based success detection is structurally
wrong for this binary.

## Workaround

- Spawn detached, ignore the exit code, treat "spawn succeeded" as success
  (the referenced fire-and-forget fix).
- Generalize: for Windows shell-handoff binaries (explorer, start), never
  encode success as exit 0.


---


# if (nativecmd) branches on whether it PRINTED, so a silent success is falsy and a noisy failure is truthy

## Symptom

You write the thing every other shell taught you:

```powershell
if (mytool --check) { "ok" } else { "failed" }
```

It answers confidently and it is **backwards**. A tool that succeeded silently
reports failure; a tool that failed loudly reports success.

## Repro

```powershell
if (node -e "process.exit(0)") { "truthy" } else { "falsy" }
# falsy      <- succeeded, reported as failure

if (node -e "process.exit(1)") { "truthy" } else { "falsy" }
# falsy      <- failed; right answer, wrong reason

if (node -e "console.log('x'); process.exit(1)") { "truthy" } else { "falsy" }
# truthy     <- FAILED, reported as success
```

Full truth table, with `$LASTEXITCODE` shown for contrast:

| tool behaviour | exit | `if (...)` says | correct? |
|---|---|---|---|
| silent, succeeds | 0 | falsy | **no** |
| silent, fails | 1 | falsy | by accident |
| prints output, fails | 1 | **truthy** | **no** |
| prints output, succeeds | 0 | truthy | by accident |

The condition tracks **whether the command printed anything**, not whether it
worked.

## Cause

A native command in a PowerShell expression evaluates to its captured *output*,
not its exit status. The `if` then applies normal truthiness to that value: an
empty result is false, a non-empty string or array is true. Exit codes never
enter the expression.

This is worse than a missing feature, because the failure correlates with
verbosity. Quiet, well-behaved tools — the ones that print nothing on success —
are precisely the ones this always gets wrong.

### A related surprise in the same area

The captured value's **type changes with the number of output lines**:

```powershell
$o = node -e "console.log('one')"
$o.GetType().Name           # String

$o = node -e "console.log('a'); console.log('b')"
$o.GetType().Name           # Object[]
$o.Length                   # 2
```

So `$o -eq "expected"`, `$o.Trim()` and `$o.Length` all mean different things
depending on how much the tool decided to say. A one-line log message turns a
working comparison into an array membership test.

## Workaround

```powershell
node -e "process.exit(1)"
if ($LASTEXITCODE -eq 0) { "ok" } else { "failed with $LASTEXITCODE" }
# failed with 1
```

Run the command as a **statement**, then branch on `$LASTEXITCODE` on the next
line. Never put a native command inside `if (...)`, `while (...)`, `-and` or
`-or`. When you need the output too, capture it separately and force an array
with `@(...)` so the type stops depending on line count.

---

`exit-code-vs-dollar-q` covers `$?` lying about native commands and prescribes
`$LASTEXITCODE`. This case is the shape people actually write — the native
command placed *directly* in the condition — where `$?` is never consulted at
all and the branch is decided by output volume. The output-type-changes-with-
line-count behaviour is not recorded anywhere in the archive either.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---


# exit 1 inside irm | iex kills the user's terminal

## Symptom

A user runs the documented one-liner `irm https://example.com/install.ps1 | iex`.
The installer hits an error path with `exit 1` — and the user's ENTIRE
interactive PowerShell session closes. No error message survives; the window is
just gone.

## Repro

```powershell
# In an interactive session:
"exit 1" | iex        # your terminal closes.
# vs
powershell -File failing.ps1   # child exits 1; your session survives.
```

## Cause

`iex` runs the script text in the CURRENT session, so `exit` terminates the
caller's host — the interactive terminal for the copy-paste install flow. The
same script under `-File` gets its own process, where `exit N` is the correct
way to return a code. One script, two execution models, opposite semantics.

## Workaround

- Fail with `throw` (catchable, survivable under `iex`) instead of `exit`.
  Under `-File`, an uncaught throw still yields a non-zero exit code.
- The referenced fix replaced every error-path `exit 1` with a `throw` in a
  `Stop-Install` helper, keeping both distribution modes correct — and pinned
  it with a throw-vs-exit contract test suite.


---


# killing a child leaves its grandchildren running, and the fix for that kills the process asking for it

## Symptom

Two failures that look unrelated and are the same missing abstraction.

**Orphans.** A timeout fires, you call `child.kill()`, the timeout handler reports
success — and the shell that child spawned is still running, still holding a port,
still writing to a file you are about to delete. Every process listing shows the
direct child gone.

**Suicide.** You switch to `taskkill /T` to fix that, and now a restart command
run from inside the tree kills ITSELF partway through. The service goes down, the
line that was supposed to start it again never executes, and nothing recovers
because the thing that would have recovered it is dead.

## Repro

Orphans:

```js
const child = spawn("cmd.exe", ["/c", "node long-running-child.js"]);
setTimeout(() => child.kill(), 1000);
// cmd.exe dies; node long-running-child.js keeps running
```

Suicide:

```
C:\> taskkill /PID <gateway-pid> /T /F
SUCCESS: ...
C:\> schtasks /Run /TN gateway      <- never reached: this shell was in the tree
```

On POSIX neither happens, because `kill(-pgid, SIGTERM)` addresses a group you
opted into and your own process is not in it unless you put it there.

## Cause

Windows has no POSIX process group. `ChildProcess.kill()` maps to
`TerminateProcess` on one PID, and `TerminateProcess` does not touch descendants,
so anything your child spawned is orphaned and reparented to nothing in
particular.

`taskkill /T` walks the parent-PID chain instead — which is the only readily
available tree operation, and it is the WRONG shape for the job. It does not know
about a group you chose; it kills whatever happens to descend from the target at
that instant. An agent's exec process is typically a descendant of the very
service being restarted, so "restart the gateway" resolves to "kill the gateway
and also me".

So the two failures are one gap: there is no cheap way to say "this set of
processes" on Windows, and both available primitives answer a different question
than the one you asked.

## Workaround

Use a Job Object, which is the actual Windows equivalent of a process group:

```
CreateJobObject -> AssignProcessToJobObject(child)
  with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
-> closing the handle kills exactly the members, and nothing else
```

Membership is explicit, so it cannot sweep up a caller that merely happens to be
downstream. In Node this needs a native addon or a helper process; several
packages wrap it.

When `taskkill /T` is what you have, break the ancestry before you use it. Spawn
the target with `DETACHED_PROCESS` or via a scheduled task so it is not your
descendant, and run the restart from outside the tree — a scheduled task, a
service control call, or a small helper the tree does not contain.

Whatever you choose, verify termination rather than trusting the call: check that
the PIDs are gone and that the port is free before reporting success. Both
failures above reported success.

---

`unlink-while-open-ebusy` is what the orphan does to you afterwards — a surviving
grandchild holds a file and your cleanup fails with EBUSY.
`startup-artifact-is-not-a-process` is the reporting half: no supervisor is
tracking any of this, so the state you display is whatever you inferred.


---


# perl's alarm deadline reports the kill as 3584 under Cygwin perl, so a 128+signal check never matches

## Symptom

You use the portable POSIX deadline idiom, because `timeout` is not dependable on
Windows and `perl` is usually around:

```
perl -e 'alarm shift; exec @ARGV' 300 mytool run
```

Then you branch on the documented signal convention:

```
if [ $? -eq 142 ]; then echo "deadline fired"; fi     # 128 + SIGALRM(14)
```

The deadline fires correctly — the child really is killed on time — and the branch
never runs. The run is reported as an ordinary failure with an exit code nobody
recognises, so a timeout gets triaged as a crash.

## Repro

On Windows, `perl` is almost always Git for Windows' Cygwin build:

```
PS> (Get-Command perl).Source
C:\Program Files\Git\usr\bin\perl.exe
PS> perl -v
This is perl 5, version 42, subversion 2 (v5.42.2) built for x86_64-cygwin-thread-multi
```

```
PS> perl -e "alarm shift; exec @ARGV" 2 ping -n 10 127.0.0.1 *> $null
PS> $LASTEXITCODE
3584
```

3584 is `14 << 8` — SIGALRM in the high byte of a `wait()` status word, not the
shell-level `128 + signal` encoding.

Control, same idiom on macOS with the base-system perl:

```
$ perl -e 'alarm shift; exec @ARGV' 2 sleep 30; echo $?
142
```

Same command, same perl idiom, same signal — two different numbers.

## Cause

`128 + signal` is a **shell** convention. A POSIX shell decodes the raw status word
from `wait()` and re-encodes a signal death as `128 + n` before handing it to `$?`.
The raw word itself puts the exit code in the high byte and the signal in the low
byte; `14 << 8` is what you get when that word is surfaced without the shell's
translation.

On Windows there is no process that performs it. A Win32 process has a single
32-bit exit code and no signal concept, so the Cygwin layer hands its emulated
status straight through, and PowerShell's `$LASTEXITCODE` reports it verbatim.
Inside Git Bash the value is translated as expected; the moment the same one-liner
is driven from PowerShell, cmd, or a CI runner that is not a POSIX shell, it is not.

That is the trap: the idiom is portable, the process really is killed on schedule,
and only the number that tells you *why* it died changes.

## Workaround

Use the native deadline, which never encodes an exit status as a signal:

```powershell
$p = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru
if (-not $p.WaitForExit($ms)) { $p.Kill($true); exit 142 }
exit $p.ExitCode
```

Choosing 142 yourself keeps one deadline sentinel across platforms, which is the
part the perl idiom was bought for.

If you must keep the perl spelling for a script that runs on both, do not compare
to a literal. Accept either encoding:

```
code=$?
if [ $code -eq 142 ] || [ $code -eq 3584 ]; then echo "deadline fired"; fi
```

Do not switch the comparison to "non-zero means timeout" to paper over it — a
genuine failure inside the deadline is also non-zero, and conflating the two is how
a timeout-retry loop starts retrying real errors forever.

---

`exit-code-vs-dollar-q` and `if-nativecmd-truthiness` cover reading the wrong
success signal. This one is about reading the right variable and getting a number
from a different encoding. `explorer-exits-one` is the other "this exit code does
not mean what the manual says" case.


---


# your CLI prints the right answer and then crashes with 0xC0000409, because process.exit ran while a socket was still closing

## Symptom

The command works. The output is correct and complete. Then the process dies with
an exit code that means "the runtime detected corruption":

```
PS> mytool status
server: healthy
PS> $LASTEXITCODE
-1073740791          # 0xC0000409, STATUS_STACK_BUFFER_OVERRUN
```

Which sends you looking for memory corruption in your own code, where there is
none. CI turns red on a command whose output the same job just asserted was right.

On macOS and Linux the identical code exits 0.

## Repro

Any short-lived Node program that makes an HTTP request and then exits promptly:

```js
const r = await fetch("http://127.0.0.1:8080/api/health");
console.log((await r.json()).status);
process.exit(0);        // <- the crash
```

It is intermittent by nature — it needs the exit to land inside the window while
a handle is closing — so it shows up as a flaky Windows CI job long before anyone
reproduces it on purpose.

## Cause

`process.exit()` tears the runtime down immediately, without waiting for libuv to
finish closing handles. If a handle is in `UV_HANDLE_CLOSING` at that moment,
libuv trips an internal assertion, and Windows reports an aborted runtime as
`0xC0000409` — the fastfail code, whose documented meaning is stack buffer
overrun. The exit code describes the abort mechanism, not your bug.

`fetch` makes this easy to hit because undici keeps connections alive by default:
the socket is still open when your program is logically done, so an immediate exit
lands squarely in the closing window. `AbortSignal.timeout()` adds a second
handle with the same property — the timer outlives the request it was guarding
unless you clear it.

POSIX platforms tear down without the assertion, so the same race produces a clean
exit and nobody notices the code was wrong.

## Workaround

Set the code and let the loop drain:

```js
process.exitCode = 1;   // not process.exit(1)
return;                 // unwind normally; Node exits when handles are done
```

Then remove the handles that keep the loop alive rather than killing the loop:

```js
// close keep-alive sockets on a short-lived client
await fetch(url, { headers: { connection: "close" } });

// clear a timeout guard once the await resolves
const t = setTimeout(() => ctrl.abort(), 600);
try { await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
```

If you have a deep call stack and need to bail out, throw a sentinel and catch it
at the top level rather than calling `exit` from the middle.

The one case that still needs `process.exit()` is a deliberately stuck process,
and there the right shape is a bounded `unref`'d timer that fires only after the
graceful path has had its chance.

---

The corpus's other exit-code cases are about a status being lost, faked, or
misread. This one is about the exit itself being unsafe: the call you use to
report success is what makes the process report corruption.


---


# A handled $LASTEXITCODE still fails your CI step

## Symptom

A `shell: pwsh` GitHub Actions step runs a native command whose non-zero exit is
EXPECTED (e.g. `schtasks /query` returning 1 because the task was already
deleted — which is success for an uninstall check). The script handles the code
correctly, prints the right message... and the step still fails red.

## Repro

```yaml
- shell: pwsh
  run: |
    schtasks /query /tn "gone-task" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "task removed - OK" }
    # step exits 1 anyway: the last native exit code leaks into the step result
```

## Cause

The pwsh process exit code defaults to the LAST native command's exit code when
the script ends without an explicit `exit`. Actions' `shell: pwsh` wrapper
surfaces that as step failure — even though your logic already consumed and
handled the value. This is distinct from exit-code-vs-dollar-q ($? lying): here
you READ `$LASTEXITCODE` correctly and it still leaks.

## Workaround

- End the script (or the expected-failure branch) with an explicit `exit 0`.
- Treat every `shell: pwsh` step whose last statement is a native command as
  suspect; make the final exit explicit.


---


# Start-Process never sets LASTEXITCODE, so a failed process inherits the previous command's success

## Symptom

A CI gate passes on a process that failed.

## Repro

```powershell
node -e "process.exit(0)"                                        # something earlier succeeded
Start-Process -FilePath node -ArgumentList "-e","process.exit(1)" -Wait -NoNewWindow
if ($LASTEXITCODE -eq 0) { "CI GATE PASSED" } else { "failed" }
# CI GATE PASSED
```

The child exited 1. The gate checked `$LASTEXITCODE` correctly. It still passed.

## Cause

`Start-Process` is not a native command invocation — it is a cmdlet that asks
Windows to start a process. It **does not touch `$LASTEXITCODE` at all**.

That is the whole trap: the variable is not set to 0, it is *left alone*, so it
still holds whatever the last real native command put there.

```powershell
node -e "process.exit(3)"
"before=$LASTEXITCODE"                                            # before=3
Start-Process -FilePath node -ArgumentList "-e","process.exit(7)" -Wait -NoNewWindow
"after=$LASTEXITCODE"                                             # after=3
```

The failed process exited 7 and the variable still reads 3. Your gate is
reporting on a command that ran earlier, possibly in a different step.

On a fresh shell `$LASTEXITCODE` is simply empty:

```powershell
Start-Process -FilePath node -ArgumentList "-e","process.exit(7)" -Wait -NoNewWindow
"LASTEXITCODE=$LASTEXITCODE"      # LASTEXITCODE=      (empty, not 7, not 0)
```

And `$?` does not help either — it reports whether the *cmdlet* succeeded in
launching, which it did:

```powershell
Start-Process ... -Wait -NoNewWindow
"dollar-q=$?"                     # dollar-q=True      for a process that exited 7
```

## The output trap that comes with it

```powershell
$out = Start-Process -FilePath node -ArgumentList "-e","console.log('hello')" \
                     -Wait -NoNewWindow -PassThru
"captured=[" + $out.StandardOutput + "]"
# hello              <- printed to the console
# captured=[]        <- and captured as nothing
```

You can *see* the output, so it looks captured. `StandardOutput` is empty
because the stream was never redirected. Contrast the call operator:

```powershell
$out = & node -e "console.log('hello')"
"captured=[" + $out + "]"         # captured=[hello]
```

## Workaround

```powershell
# exit code: -PassThru and read ExitCode
$p = Start-Process -FilePath node -ArgumentList "-e","process.exit(7)" -Wait -PassThru -NoNewWindow
$p.ExitCode                       # 7

# output: redirect to a file, there is no in-memory option
$p = Start-Process -FilePath node -ArgumentList "-e","console.log('captured')" \
                   -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\o.txt"
Get-Content "$env:TEMP\o.txt"     # captured
```

`-Wait` alone is not enough — it waits, but tells you nothing. `-PassThru` is
what makes the result observable.

Better still: unless you specifically need a new process window, a different
user, or a detached child, do not use `Start-Process`. Call the program
directly or with `&`, where `$LASTEXITCODE` and output capture both behave.

---

Two archive cases mention `Start-Process`
(`join-semicolon-splits-startprocess`, `bun-ps-windowstyle-argv`) and both are
about how *arguments* reach it. Neither mentions `ExitCode`, `$LASTEXITCODE` or
`PassThru` — grepping those three terms across both files returns nothing.

This is a different failure: the arguments arrive fine, the process runs fine,
and the *result* is invisible.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---


# Windows autostart has no supervisor, so a registered Startup entry reports the service as running when nothing is

## Symptom

You port a background service from launchd or systemd to Windows. `status` says
loaded, `stop` says stopped, and both are lies. The dashboard is green while the
process is dead; the stop command returns success while the process keeps running.

On the POSIX side you never wrote this bug, because you asked the supervisor and
the supervisor knew.

## Repro

A Startup-folder entry has no run-state at all:

```powershell
PS> $startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
PS> Copy-Item app.cmd $startup
PS> Test-Path "$startup\app.cmd"
True                                  # true forever, whether or not it ever ran
```

A Scheduled Task does have state, and that is the subtler half — it reports the
TASK HOST, not the thing the host launched:

```powershell
PS> schtasks /Query /TN MyApp /FO LIST /V | Select-String "Status|Last Result"
Status:            Ready
Last Result:       0
```

`Ready` means "not currently executing the action"; `Last Result: 0` means the
action it launched returned success. Your detached server started, the launcher
returned 0, and the task went back to Ready. That reads identically whether the
server is serving or died ninety seconds later.

## Cause

launchd and systemd are supervisors: they own the process, so "is it loaded" and
"is it running" are the same question and they answer it authoritatively.

Windows autostart mechanisms are not supervisors. A Startup-folder `.cmd` is a
file Explorer executes once at logon and then forgets entirely.

A Scheduled Task is closer but still not one. It tracks its own execution — the
API exposes `TASK_STATE_RUNNING` and the CLI shows Status and Last Result — and
that state is about the task instance. The moment your action detaches a server
and returns, the task is done and its state stops describing your process. So the
question "is the task registered" has an answer, "is the task running" has an
answer, and "is my daemon alive" has none.

Neither owns your process, so registration and liveness are independent facts, and
code ported from a supervisor platform reads the one it can get as the one it
wants.

The tempting fallback makes it worse. Probing your own HTTP health endpoint is
unattributable: if your process died and a foreign one bound the port, the health
check answers 200 and you report healthy about someone else's server.

## Workaround

Derive liveness from a pidfile you own and verify, and keep it separate from
registration:

```
registered = the Startup entry or Scheduled Task exists
running    = pidfile exists AND that pid is alive AND it is ours
```

"It is ours" needs a real check — the pid must still be alive and its identity
must match what you recorded (start time, launch fingerprint, or a token the
process wrote), because pids are reused. Write the pidfile from inside the
process, not from the launcher.

After starting, poll for ownership to appear rather than asserting success; the
launcher returning 0 only means the launch was requested. Report the two states
separately in your UI, since "registered but not running" is a real and
diagnosable condition on Windows in a way it is not under a supervisor.

---

The corpus's other exit-code cases are about a command's own status being lost or
faked. This one is about a status nobody is tracking at all: there is no process
supervisor to ask, so any code that assumes one invents an answer.
