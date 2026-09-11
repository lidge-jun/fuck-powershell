---
id: perl-alarm-raw-wait-status
title: "perl's alarm deadline reports the kill as 3584 under Cygwin perl, so a 128+signal check never matches"
category: exit-codes
versions: "both"
failure: misleading-error
context: [script, ci, agent]
source: first-party
repro: verified
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/56
ontology:
  affects: [shell-powershell-51, shell-pwsh-7, env-windows]
  invokes: [command-start-process]
  manifests_as: [error-exit-code-leak]
  caused_by: [mechanism-exit-code-propagation]
  mitigated_by: [workaround-native-process-deadline, workaround-passthru-exitcode]
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
