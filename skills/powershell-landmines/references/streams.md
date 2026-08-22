
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


# Out-String turns one stderr line into eight and injects your own script text into the log

## Symptom

A tool writes **one** line to stderr. Your saved log has **eight**, and six of
them are fragments of your own script — the command line, a row of `~~~~`
squiggles pointing at it, and `CategoryInfo` / `FullyQualifiedErrorId` rows.

Line counts in CI become meaningless, log diffs are noise, and an agent reading
the log sees its own source code echoed back as if it were program output.

## Repro

A child that writes exactly one line to each stream and exits 0:

```js
// exit.mjs
process.stdout.write("stdout-line\n");
process.stderr.write("stderr-line\n");
process.exit(Number(process.argv[2] ?? 0));
```

```powershell
node exit.mjs 0 2>&1 | Out-String -Width 200 | Set-Content run.log
(Get-Content run.log | Measure-Object -Line).Lines
# 8        <- expected 2
```

What actually lands in the log:

```
stdout-line
node : stderr-line
At line:2 char:6
+ $o = node exit.mjs 0 2>&1; ($o | Out-String) -spli ...
+      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (stderr-line:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
```

Note the third and fourth lines: **your script's own text is now log content.**

## Cause

Under 5.1, `2>&1` wraps each native stderr line in an `ErrorRecord`. That object
is fine while it stays an object — `-match` filters it, `Select-String` finds it,
and `Set-Content` writes just the message. But `Out-String` renders it the way
the console would, and the console rendering of an `ErrorRecord` includes the
invocation context: position line, the offending source text, the squiggle
underline, and two trailing metadata rows.

So the corruption is introduced by the *formatter*, not by the redirection, which
is why it appears only in some pipelines.

A second consequence, easy to hit while debugging this: the merged stream is not
string-typed, so string methods fail on it.

```powershell
$o = node exit.mjs 0 2>&1
$o | ForEach-Object { $_.GetType().Name }   # String, ErrorRecord
$o[1].Substring(0,6)
# Method invocation failed because [System.Management.Automation.ErrorRecord]
# does not contain a method named 'Substring'.
```

## What does and does not corrupt

| pipeline | result |
|---|---|
| `... 2>&1 \| Set-Content log` | clean, 26 bytes, message only |
| `... 2>&1 \| Select-String p` | clean, matches the message |
| `... 2>&1 \| Where-Object { $_ -match p }` | works, stays `ErrorRecord` |
| `... 2>&1 \| Out-String \| Set-Content log` | **8 lines, script text injected** |

`$LASTEXITCODE` is *not* part of this problem — it propagated correctly as `3`
through `Select-String`, `Tee-Object`, `Out-String` and `Select-Object` in the
same test run. The damage is confined to rendered text.

## Workaround

```powershell
# do not render objects you intend to store or grep
node exit.mjs 0 2>&1 | Set-Content run.log

# if you must flatten, project to the message first
node exit.mjs 0 2>&1 | ForEach-Object { "$_" } | Set-Content run.log
```

Treat `Out-String` as a **display** cmdlet. The moment its output is stored,
diffed, counted or fed to another program, it is the wrong tool.

---

`native-stderr-errorrecord` covers the `ErrorRecord` wrapping itself and its
interaction with `$ErrorActionPreference = 'Stop'`. This case is about what
happens **after** you have accepted the wrapping and merely try to save or count
the output: one line becomes eight, and your own script text ends up inside the
artifact. Neither `Out-String` nor the line-inflation effect appears anywhere in
the archive today.

## Environment

`$PSVersionTable`: `5.1.26100.7705`, Edition `Desktop`, Windows 11, Node 22.14.


---


# Write-Host output is invisible to 2>&1 | Out-String

## Symptom

A test captures "everything" with 2>&1 | Out-String — and the capture is EMPTY,
though the script clearly prints when run interactively. Assertions fail
against a blank string.

## Repro

```powershell
$out = & { Write-Host "important message" } 2>&1 | Out-String
$out.Length    # 0 — the message went to the host, not the pipeline
```

## Cause

Write-Host writes to the HOST, not the success stream. 2>&1 merges stderr only;
the message never enters the captured pipeline. In-process capture of host
output needs a different observer entirely.

## Workaround

- Script authors: Write-Output for capturable content; Write-Host only for
  human-only chrome.
- Test authors: 6>&1 merges the information stream, or wrap the run in
  Start-Transcript / Stop-Transcript (the referenced fix) to observe host
  output reliably.


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
