
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
