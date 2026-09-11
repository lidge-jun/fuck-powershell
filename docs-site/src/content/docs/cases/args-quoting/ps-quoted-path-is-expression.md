---
title: "a quoted path at the start of a line is an expression, not a command, so the line your tool emits runs under cmd.exe and dies under both PowerShells"
description: "args-quoting landmine — hard-error (both)"
sidebar:
  label: "ps quoted PATH is expression"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-hard-error">hard-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#expression-vs-command-mode">expression-vs-command-mode</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">powershell 51, pwsh 7, cmd, windows</span></div><div class="row"><span class="k">Fails as</span><span class="v">PARSERERROR</span></div><div class="row"><span class="k">Mechanism</span><span class="v">expression vs command mode</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">call operator</span></span></div></div>

## Symptom

Every hook your tool patched fails at once. Exit 1, no output, nothing in the log.
The line it emitted looks unimpeachable:

```
"C:\Users\me\plugin\_hooks\run-hook.cmd" sessionstart
```

Paste it into cmd.exe and it runs. Under Windows PowerShell 5.1 and pwsh 7 it is a
ParserError, and the error blames the *argument*:

```
Unexpected token 'sessionstart' in expression or statement.
FullyQualifiedErrorId : UnexpectedToken
```

The path is fine. The file is there. Nothing is wrong with either.

## Repro

Point a `.cmd` at `echo GOT=[%1]` and send the same line through all three:

| line | powershell 5.1 | pwsh 7 | cmd.exe |
|---|---|---|---|
| `"<path>" sessionstart` | ParserError, exit 1 | ParserError, exit 1 | `GOT=[sessionstart]`, exit 0 |
| `cmd /c "<path>" sessionstart` | exit 0 | exit 0 | exit 0 |
| `& "<path>" sessionstart` | exit 0 | exit 0 | n/a |

Measure the cmd.exe row from **inside a `.cmd` file**. Handing the line to
`spawnSync` as an argv puts another quoting layer in front of it and produces a
false negative — that happened while measuring this case, and it is the easy way
to get the wrong answer.

## Cause

PowerShell decides how to read a line from its first token. A leading quoted
string selects *expression* mode: the string is a value, and a bare word cannot
follow a value. The parser never gets as far as asking whether the path is
executable — the opening quote already settled the question.

The instance is small. The class is not: **you do not choose the shell that runs
what you emit.** A tool that writes a command into a config file is writing for
whatever the host decides to dispatch through, and hosts differ — one hands the
line to cmd.exe, another to the session shell. The two PowerShell editions install
side by side and parse this identically, so the useful question is never *which*
edition the user drives, only whether *a* PowerShell is anywhere in the chain.

## Workaround

Two fixes, for two different amounts of knowledge.

```powershell
& "C:\path with spaces\tool.cmd" sessionstart      # you know PowerShell parses this
cmd /c "C:\path with spaces\tool.cmd" sessionstart # you do not know who parses this
```

`&` is the call operator: it forces command mode. Use it when the line is yours.

`cmd /c` is the one that survives an unknown dispatcher, because `cmd` is a
command in all three shells and hands the quoted path to the cmd.exe you wanted in
the first place. It is not free: read `msys-rewrites-slash-args` before you reach
for it, because a Git Bash hop rewrites that `/c` into `C:/` and the fix becomes
the next bug.

Test it across every shell that could be in the chain, not the first one that
works. 5.1 is always present, so it is always worth running; pwsh only when
installed. A matrix that stops at its first green row passes on your machine and
fails on the machine of anyone driving the shell it never reached.

## What not to do

Do not try to escape your way out of it. The quotes are not the problem — they are
load-bearing, because the path contains spaces. Stripping them to dodge expression
mode trades this failure for a path that tokenizes at the first space. An 8.3 short
path also removes the quotes and works, right up until it meets a volume with 8.3
name generation disabled or a directory that has no short name.

## Refs

- <https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md>
- <https://github.com/LilMGenius/win-hooks/commit/0be564a1ed7d8d35e61d31e8b1a5a76d924a33bf>
