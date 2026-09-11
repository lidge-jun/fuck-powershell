---
title: "Git Bash rewrites /c into C:/ before the child sees it, so the cmd hop that fixed PowerShell breaks the moment bash is in the chain"
description: "args-quoting landmine — misleading-error (both)"
sidebar:
  label: "msys rewrites slash args"
---

<p class="case-eyebrow">args quoting · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">agent</span><span class="badge badge-context">ci</span><span class="badge badge-context">script</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: verified</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#msys-path-conversion">msys-path-conversion</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">cmd, windows, node</span></div><div class="row"><span class="k">Fails as</span><span class="v">COMMAND NOT RECOGNIZED</span></div><div class="row"><span class="k">Mechanism</span><span class="v">msys path conversion</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">msys no pathconv</span></span></div></div>

## Symptom

You added `cmd /c` in front of a command to make it survive PowerShell
(`ps-quoted-path-is-expression`). It works. Then the same line runs somewhere with
Git Bash in the chain, and cmd.exe reports a command it has never heard of — or
starts interpreting your first real argument as a switch. The `/c` never arrived.

## Repro

Give a child something that prints its own argv, and look at what it received:

```bash
# argv.js is: console.log('ARGV=' + JSON.stringify(process.argv.slice(2)))
bash -c 'node argv.js /c /tmp/x //c'
#   -> ARGV=["C:/","C:/Users/you/AppData/Local/Temp/x","/c"]

MSYS_NO_PATHCONV=1 bash -c 'node argv.js /c /tmp/x //c'
#   -> ARGV=["/c","/tmp/x","//c"]
```

One line shows all three behaviours at once. `/c` becomes `C:/`. A genuine POSIX
path is translated to its Windows equivalent, which is the feature this exists for.
And `//c` — the documented escape — arrives as `/c`, which is what you wanted.

Measured with `C:\Program Files\Git\bin\bash.exe`.

## Cause

MSYS2, which Git for Windows is built on, converts arguments that look like POSIX
paths when it launches a child that is not itself an MSYS program. The conversion
is correct and necessary for `/tmp/x`; the trouble is that a lone `/c` is
indistinguishable from an absolute path whose root is one character long.

The conversion happens in the launcher, before the child's command line is built,
so no amount of quoting *inside* the command reaches it. Single quotes, double
quotes, backslashes — all of them are consumed by bash first and the surviving
argument is still a POSIX-shaped path.

## Workaround

Either tell MSYS not to convert, or write the argument in the form it leaves alone:

```bash
MSYS_NO_PATHCONV=1 cmd /c "C:/tool.cmd" sessionstart   # disable conversion
cmd //c "C:/tool.cmd" sessionstart                      # the // escape
```

Both are measured above. `MSYS_NO_PATHCONV=1` is a blunt instrument — it disables
conversion for every argument in that invocation, including the ones you wanted
converted — so prefer it when you control the whole command and `//c` when you do not.

The better fix is one level up: stop emitting a single line and hoping. Decide the
prefix per dispatcher. win-hooks does exactly this — its Codex hook reference
carries `cmd /c` because Codex hands the command to a PowerShell, and its Claude
hook reference deliberately does not, because Claude's chain can include Git Bash.
Two consumers, two strings, one rule written down next to each.

## Why this is worth a case of its own

The two fixes point in opposite directions. `ps-quoted-path-is-expression` says add
`cmd /c`; this case says a `cmd /c` is destroyed by a bash hop. Neither is wrong,
and an agent that has read only one of them will apply it everywhere and break the
other half of the matrix. If you are emitting a command that a host will dispatch,
you need both facts at the same time.

## Refs

- <https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md>
- <https://github.com/LilMGenius/win-hooks/commit/0be564a1ed7d8d35e61d31e8b1a5a76d924a33bf>
