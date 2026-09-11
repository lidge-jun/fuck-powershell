---
title: "your Windows checkout writes CRLF into the shebang, Git Bash runs it anyway, and the Linux runner reports an interpreter that plainly exists as missing"
description: "encoding landmine — misleading-error (both)"
sidebar:
  label: "autocrlf shebang cr"
---

<p class="case-eyebrow">encoding · case</p>

<div class="case-badges"><span class="badge badge-version">both</span><span class="badge badge-failure-misleading-error">misleading-error</span><span class="badge badge-context">ci</span><span class="badge badge-context">agent</span><span class="badge badge-context">script</span><span class="badge badge-meta">third-party</span><span class="badge badge-meta">repro: historical</span><a class="badge badge-mech" href="/fuck-powershell/ontology/mechanisms/#crlf-residue">crlf-residue</a></div>

<div class="case-glance"><div class="row"><span class="k">Affects</span><span class="v">windows, actions runner</span></div><div class="row"><span class="k">Fails as</span><span class="v">BAD INTERPRETER</span></div><div class="row"><span class="k">Mechanism</span><span class="v">crlf residue</span></div><div class="row"><span class="k">Safe fix</span><span class="v"><span class="fix">gitattributes eol lf</span></span></div></div>

## Symptom

```
bash: ./script.sh: /bin/bash^M: bad interpreter: No such file or directory
```

On a machine where `/bin/bash` exists and runs. Most terminals swallow the `^M`,
so what you usually see is "No such file or directory" pointing at a file that is
visibly right there — or at an interpreter you can invoke by hand in the next line
of the same shell.

It appears on the CI runner, in the container, or under WSL. It never appears on
the Windows machine that produced it, and that asymmetry is the real subject here.

## Repro

Two halves, and only one of them is reproducible from Windows.

The half that reproduces:

```
git config --get core.autocrlf     # true
# write #!/bin/bash + echo MARKER_OK with CRLF endings, then:
bash script.sh                     # MARKER_OK, exit 0
./script.sh                        # MARKER_OK, exit 0
```

Measured with `C:\Program Files\Git\bin\bash.exe`. **Git for Windows tolerates the
carriage return**, both by direct execution and via an explicit `bash`.

The half that does not reproduce here: the same file on a Linux runner, in a
container, or under WSL, where the exec layer does not tolerate it. Clone the
repository with `core.autocrlf=true` and with `false` and compare
`od -c script.sh | head -1` to see the `\r` that gets shipped.

## Cause

A shebang is read by whatever POSIX exec layer runs the file, and it takes
everything after `#!` up to the newline. With CRLF endings the carriage return
falls inside the interpreter *name*, so the lookup is for a binary literally called
`bash\r`, which does not exist. Hence "no such file" about a file that exists.

Two things make this specifically a Windows-authored bug that fails somewhere else:

- `core.autocrlf=true` converts on **checkout**. The bytes committed to the
  repository are correct; only the working tree is wrong. Code review cannot see it.
- Nothing on the authoring machine complains. The Windows loader never reads a
  shebang at all, and Git for Windows' own bash tolerates the `\r` — measured
  above. So the last local signal is gone too.

The failure is deferred to the first real POSIX exec, which is usually CI.

## Verification note

The Git Bash tolerance is measured on this host. The `bad interpreter` failure
itself is not reproducible here and is attributed to the cited sources. That
asymmetry is not a gap in the case — it is what the case is about.

## Workaround

Pin the line endings in the repository rather than trusting each contributor's
git config:

```gitattributes
* text=auto eol=lf
hooks/run-hook.cmd -text
```

The second line is the part people forget, and it matters: a polyglot `.cmd`
dispatched by cmd.exe wants CRLF. A blanket `eol=lf` trades this failure for
`cmd-lf-drops-first-byte`, where cmd.exe's line-seek arithmetic starts eating the
first byte of lines and `npm` becomes `pm`. Both rules are right; they just apply
to different files, so the exceptions have to be written down.

If you cannot change `.gitattributes`, normalizing at the consumer (`sed -i 's/\r$//'`
in the CI step) works but is a patch on every pipeline instead of one on the repo.

## Refs

- <https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md>
- <https://github.com/LilMGenius/win-hooks/commit/006716a3e19e0ddcabf05efae0de151b2c3b1a27>
