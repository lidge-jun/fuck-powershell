---
id: start-process-no-lastexitcode
title: "Start-Process never sets LASTEXITCODE, so a failed process inherits the previous command's success"
category: exit-codes
versions: "both"
failure: silent
context: [ci, script, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/17
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
