---
id: windowsapps-python3-stub-needs-probe
title: "where.exe finds python3 and running it offers to install Python: the alias that satisfies every presence check is not an interpreter, and the path test that catches it also rejects the real thing"
category: env-paths
versions: "both"
failure: misleading-error
context: [agent, ci, script]
source: third-party
repro: verified
refs:
  - https://github.com/LilMGenius/win-hooks/commit/ed2d8e8332ce611ec29e6cc9a3aacd1132efb89e
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/AGENTS.md
ontology:
  affects: [env-windows, runtime-python]
  invokes: [command-where]
  manifests_as: [error-python-not-found]
  caused_by: [mechanism-app-execution-alias-stub]
  mitigated_by: [workaround-functional-interpreter-probe]
  unsafe_fix: [workaround-skip-windowsapps]
  related_to: [case:windowsapps-alias-eperm]
---

# where.exe finds python3 and running it offers to install Python: the alias that satisfies every presence check is not an interpreter, and the path test that catches it also rejects the real thing

## Symptom

A tool that calls `python3` fails, and every check you run says Python is
installed. `where python3` prints a path. The file is there. Running it prints a
*sentence*:

```
Python was not found; run without arguments to install from the Microsoft Store,
or disable this shortcut from Settings > Apps > Advanced app settings >
App execution aliases.
```

That is not an error message from your program. It is an advertisement, and your
program received exit code 9009.

## Repro

Measured on Windows 11 with the Store aliases enabled:

```
> where python3
C:\Users\you\AppData\Local\Microsoft\WindowsApps\python3.exe
> where python
C:\Users\you\AppData\Local\Microsoft\WindowsApps\python.exe

> python3 -c ""
exit 9009, the Store message above
> python -c ""
exit 9009, identical
```

Two things there break the workaround you were about to write.

The exit code is **9009**, a normal failed process — not `ENOENT`, not `EPERM`.
Anything that classifies interpreter availability by spawn error sees a program
that started and failed, which is the same shape as a real Python with a bad flag.

And on this machine **both names** are stubs, so the usual "if `python3` is
missing, fall back to `python`" resolves to a second alias and fails identically.

Worth adding: the dispatcher matters too. The cmd.exe that runs a hook need not
resolve the same interpreter as the interactive shell you tested in by hand, so
"it works when I type it" does not transfer.

## Cause

An App Execution Alias is a real file at a real path whose entire purpose is to
advertise a Store package. Name-based identity is the trap: the bare name resolves,
so every presence check passes — `where`, `exists`, a PATH walk, an `access` probe
— and only execution reveals there is no interpreter behind it.

Do not file this under the same mechanism as `windowsapps-alias-eperm`. That case
is a packaged binary `CreateProcess` **refuses**; this one starts, prints, and
exits. Same directory, opposite behaviour, and the difference is exactly what makes
the next section necessary.

## Workaround

Resolve functionally, once, and keep the answer:

```js
// first candidate whose ABSOLUTE path actually executes a trivial program
const resolvePython = () =>
  ['python3', 'python', 'py']
    .flatMap(absoluteCandidates)
    .find(exe => spawnSync(exe, ['-c', ''], { windowsHide: true }).status === 0)
    ?? null;
```

Bake the absolute path that passed into whatever you emit. Resolving at setup time
rather than per invocation also keeps a hot path from paying an interpreter start
on every call.

If nothing passes, there is no Python. Say so and disable the work, rather than
emitting a command that will fail identically forever.

## Why the WindowsApps filter is the unsafe fix, and why the corpus says both

Skipping anything under a `WindowsApps` path segment does catch this stub. It also
rejects a legitimate Microsoft Store Python, which lives in exactly the same
directory.

This is the precise point where this case and `windowsapps-alias-eperm` disagree,
and the disagreement is real rather than a contradiction:

| question | right test |
|---|---|
| will `CreateProcess` refuse this binary? | the `WindowsApps` path segment — it is the only discriminator that works, and that case measured every alternative failing |
| is this a working interpreter? | run it — the probe is available and decisive, and the path tells you nothing |

So the graph lists the same workaround as a mitigation of one case and an unsafe
fix for the other. That is not an inconsistency to clean up; it is the finding.
Pick the test that matches the question you are actually asking.

