---
id: cmd-star-ignores-shift
title: "shift renumbers %1 and leaves %* alone, so a batch wrapper cannot drop its own first argument and forward the rest"
category: args-quoting
versions: "both"
failure: silent
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/hooks/run-hook.cmd
  - https://github.com/LilMGenius/win-hooks/commit/632c5a8b37703599fbe15dbe85d748352b833352
ontology:
  affects: [shell-cmd, env-windows]
  invokes: [command-cmd]
  caused_by: [mechanism-percent-star-unshifted]
  mitigated_by: [workaround-consume-arg-downstream]
---

# shift renumbers %1 and leaves %* alone, so a batch wrapper cannot drop its own first argument and forward the rest

## Symptom

Nothing, for a long time. A `.cmd` shim that takes a name and forwards everything
after it works for months. Then a caller passes nine arguments and the ninth is
missing from the child. No error, no truncation notice, no clue in the log — the
argument is simply not there.

## Repro

```bat
@echo off
echo BEFORE_STAR=[%*]
shift
echo AFTER_STAR=[%*]
echo AFTER_1=[%1]
```

```
> wrapper.cmd one two three
BEFORE_STAR=[one two three]
AFTER_STAR=[one two three]
AFTER_1=[two]
```

`shift` did its job: `%1` moved from `one` to `two`. `%*` did not move at all.

## Cause

`%*` is not built from the numbered parameters. It is the command tail exactly as
it arrived, and `shift` only renumbers `%1` through `%9`. The two are different
views of the same invocation, and only one of them is shiftable.

So a wrapper that must consume its first argument and forward the rest has no
correct expansion available. What it reaches for instead is

```bat
child.exe %2 %3 %4 %5 %6 %7 %8 %9
```

and that is where the famous eight-argument ceiling comes from. Be precise about
this, because it is usually reported backwards: **cmd.exe does not limit you to
eight arguments.** The ceiling belongs to the workaround, and it appears only
because `%*` was unavailable.

## Workaround

Do not consume the argument in batch at all. Forward `%*` untouched and let the
program you dispatch read its own leading token:

```bat
REM the hook name stays in the line; run.mjs reads argv[2] itself
"%WH_NODE%" "%~dp0run.mjs" %*
```

Nothing shifts, so `%*` is still correct, and the ceiling never exists. This is
the shape win-hooks settled on after the positional version capped its hooks at
eight arguments.

If you must keep the positional form, quote every one of them:

```bat
child.exe "%~2" "%~3" "%~4" "%~5" "%~6" "%~7" "%~8" "%~9"
```

`%~n` strips surrounding quotes, and re-quoting puts exactly one layer back, so an
argument containing a space survives instead of splitting into two. Unquoted
`%2 %3` loses that argument boundary silently, which is the same failure mode as
the missing ninth argument and just as hard to see.

## Why it stays invisible

Both halves of this fail quietly. A dropped ninth argument and a split third
argument produce a child that runs successfully with the wrong input, so the exit
code is 0 and the log looks normal. Nothing in the batch language will tell you;
the only way to see it is to have the child print its own argv, which is also the
repro above.

