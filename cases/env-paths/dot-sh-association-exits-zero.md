---
id: dot-sh-association-exits-zero
title: "every Windows dispatcher accepts your .sh and exits 0 without running it, because Git for Windows registered the extension and gave it nothing to do"
category: env-paths
versions: "both"
failure: silent
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
  - https://github.com/LilMGenius/win-hooks/commit/30cdcb6dc235a7f250f590f2fb6986bb0b2977b9
ontology:
  affects: [shell-cmd, shell-powershell-51, env-windows]
  invokes: [command-cmd]
  manifests_as: [error-eftype]
  caused_by: [mechanism-inert-file-association]
  mitigated_by: [workaround-dispatch-by-declared-interpreter, workaround-absolute-spawn]
  unsafe_fix: [workaround-rely-on-file-association]
  related_to: [case:caller-picks-interpreter-not-shebang]
---

# every Windows dispatcher accepts your .sh and exits 0 without running it, because Git for Windows registered the extension and gave it nothing to do

## Symptom

A config, a hook, a task or an npm script points at `something.sh`. It never runs.
There is no error. The exit code is 0. Whatever launched it records success, and any
check that asserts "the step completed" passes.

If you instead spawn the file directly from a runtime you get `EFTYPE` — an exec
format error, not `ENOENT` — which sends you looking for a corrupt file rather than a
missing interpreter.

## Repro

One script, six ways to start it. Measured on Windows 11 with Git for Windows installed:

```
hook.sh contains:  #!/bin/bash
                   echo MARKER_OK

CreateProcess direct (spawn)   code=null  err=EFTYPE
cmd /c hook.sh                 code=0     out=""      <- ran nothing, said success
cmd /c call hook.sh            code=0     out=""
cmd /c start /wait hook.sh     code=0     out=""
powershell  & hook.sh          code=0     out=""
bash hook.sh                   code=0     out="MARKER_OK"
```

And the two registry facts behind it:

```
assoc .sh   ->  .sh=sh_auto_file
echo %PATHEXT%  ->  .COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL
```

Only the last row does the thing you asked for.

## Cause

Two facts stack into silence.

`.sh` is **not an executable type**. It is not a PE image, it is not `.bat` or
`.cmd`, and it is not in `PATHEXT`. `CreateProcess` therefore refuses it outright,
which is the `EFTYPE`. Nothing in the Windows loader reads a shebang.

But `.sh` **is associated** — Git for Windows registers it as `sh_auto_file`. So the
shell-level dispatchers do not refuse it. They resolve the association, find it has no
executing verb, do nothing, and return success. An association that exists but does
nothing is worse than no association at all, because "no association" produces an error
someone can read.

The result is that the loud path and the silent path disagree, and the one your
automation is more likely to take is the silent one.

## Workaround

Name the interpreter and pass the script as an argument. Never hand a `.sh` to a
Windows dispatcher and hope:

```
bash "C:/path/to/hook.sh"          # not: hook.sh
"%WH_BASH%" "%~dp0hook.sh"         # from a .cmd, with an absolute interpreter
```

Resolve that `bash` to an absolute path rather than trusting the bare name — see
`bash-on-path-may-be-wsl` for what the bare name can resolve to on a stock machine.

If you are generating dispatch for other people's scripts, the robust shape is to
record the interpreter next to the script rather than inferring it from the suffix,
which is `caller-picks-interpreter-not-shebang`.

## Why registering an association is the unsafe fix

The tempting repair is to point `.sh` at an interpreter through `assoc`/`ftype`, or to
have your tool prepend `bash` to any command containing `.sh`. Both look like they
work and both are traps: the first is a machine-wide change your software has no
business making and that behaves differently on every user's box, and the second
double-dispatches when the command already names an interpreter, so
`bash script.sh` becomes `bash bash script.sh`. win-hooks hit exactly that and works
around it by keeping its hook names extensionless.

## Why this is not the other two extension cases

`pathext-bare-name-enoent` is about a name with **no** extension: PATHEXT is consulted,
finds nothing, and you get `ENOENT`. Here the name has an extension, so PATHEXT is
never consulted at all.

`caller-picks-interpreter-not-shebang` is about an interpreter that was **already
chosen** and runs the file in the wrong language, failing loudly with a SyntaxError.
Here nobody chose an interpreter and nothing ran.

Same family, three different outcomes: loud refusal, loud mis-execution, and silence.

