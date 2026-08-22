---
title: "Out-String turns one stderr line into eight and injects your own script text into the log"
description: "streams landmine — silent (5.1)"
---

<div class="case-badges"><span class="badge badge-version">5.1</span><span class="badge badge-failure-silent">silent</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-meta">first-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#stream-wrapping">stream-wrapping</a><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#errorrecord-format">errorrecord-format</a></div>

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

## Refs

- <https://github.com/lidge-jun/fuck-powershell/issues/8>
