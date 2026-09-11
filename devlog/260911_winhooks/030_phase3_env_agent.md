# wp4 — Batch C: environment and interpreter identity

Two cases about a probe that says yes and a runtime that does nothing. The third case
planned for this phase, `silent-timeout-kill-seconds-unit`, was **dropped** during the
audit: a host's timeout unit and a host's silent kill are host policy, which this round's
own non-goals already excluded. See `001_audit_and_measurements.md`.

**Rewritten after the audit.** Both cases changed mechanism nodes, because the ones
originally borrowed are defined for a different failure.

## Files

### NEW `cases/aliases/bash-on-path-may-be-wsl.md`

Rescoped after audit. The original title claimed the bash on your PATH *is* the WSL
launcher, which is false on any machine with Git for Windows — including this one, where
`where bash` returns Git's first. The resolution order is measured here, but the landmine
itself needs a WSL machine, so the case ships `repro: historical` with a verification note
rather than claiming more than was run.

```yaml
---
id: bash-on-path-may-be-wsl
title: "with no Git for Windows installed, the only bash on PATH is the WSL launcher: it cannot open a Windows path, and it reports success anyway"
category: aliases
versions: "both"
failure: silent
context: [agent, ci, script]
source: third-party
repro: historical
refs:
  - https://github.com/LilMGenius/win-hooks/commit/006716a3e19e0ddcabf05efae0de151b2c3b1a27
  - https://github.com/LilMGenius/win-hooks/blob/53584f9685bfe62051a5dd8130875698adceb6ce/hooks/run.mjs
ontology:
  affects: [env-windows, shell-cmd]
  invokes: [command-where]
  caused_by: [mechanism-wsl-launcher-path-translation]
  mitigated_by: [workaround-functional-interpreter-probe, workaround-absolute-spawn]
  unsafe_fix: [workaround-blacklist-bash-by-path]
  related_to: [case:timeout-is-not-a-command-wrapper]
---
```

`failure: silent` — there is no error to match on, which is the entire problem.

- **Symptom** — nothing. On a machine with WSL and without Git for Windows, everything
  dispatched through `bash` appears to run and does nothing, forever. Exit status 0, no
  stderr, and a health check that asserts "the script ran" passes.
- **Repro** — start with the part that is measurable anywhere, because it is what tells you
  whether you are exposed. On this machine (Git for Windows installed):

  ```
  where bash
    C:\Program Files\Git\usr\bin\bash.exe          <- wins
    C:\Users\you\AppData\Local\Microsoft\WindowsApps\bash.exe
  ```

  Git's bash is first, so nothing is wrong here. Uninstall Git, or run on a stock image,
  and only the second entry remains — an App Execution Alias for the WSL launcher (on some
  installs `%SystemRoot%\System32\bash.exe`). That is the machine this case is about. Then
  the check that matters: give that bash a Windows path and inspect **both** what the guest
  received and the exit status.
- **Cause** — that binary is not a POSIX shell; it is the launcher for a Linux
  distribution, which has no `C:\`. A Windows path handed to it is mangled on the way in
  (the backslashes are consumed, so `C:\x\y` arrives as `C:xy`), and WSL reaches NT files
  only through `/mnt/c`. The damaging part is the reporting: win-hooks measured the
  launcher exiting 0 after failing that way, so the caller sees success. That makes the last
  resort of every "find a bash on PATH" search, on a stock machine, a binary that swallows
  work and calls it done.
- **Verification note** — the resolution order above is measured here. The exit-0-after-
  failure behaviour is **not**: this machine has no WSL installed, so that claim is
  attributed to win-hooks' `hooks/run.mjs` and the commit cited above, which exists
  specifically to reject such a candidate.
- **Workaround** — a candidate interpreter counts only if it proves it can do the job:
  make it confirm it can *see* the file it is about to run, `bash -c 'test -f "$PROBE"'`,
  before accepting it. Two details decide whether the probe works at all:
  - pass the probe path **through the environment**, not as `$0`. WSL's launcher reports
    `$0` as `/bin/bash`, so a `test -f "$0"` probe passes on the very interpreter it exists
    to reject.
  - let known-good absolute paths (an explicit override, Git's two install locations) skip
    the probe, so the common case costs no subprocess.
  Say what a rejection should look like: one line on stderr and exit 0 — still fail-safe,
  no longer silent.
- **Why the path blacklist is the unsafe fix** — rejecting `System32\bash.exe` and
  `WindowsApps\bash.exe` by name is cheaper and does catch this instance, but it is still a
  path heuristic: it accepts an equally broken bash anywhere else, and it hard-codes a list
  that a portable, scoop or winget install is not on.
- **Contrast** — `timeout-is-not-a-command-wrapper` is the same shape one binary over: a
  stock Windows executable with a familiar POSIX name that is not that tool.

### NEW `cases/env-paths/windowsapps-python3-stub-needs-probe.md`

Re-caused after audit: `mechanism-appexeclink` is defined as a zero-byte reparse point
that EPERMs on spawn. This stub does the opposite — it runs. `repro: verified`.

```yaml
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
```

- **Symptom** — a tool that calls `python3` fails, and every check says Python is
  installed. `where python3` prints a path. The file is there. Running it prints a
  *sentence*, not an error.
- **Repro** — measured on this machine:

  ```
  where python3 -> C:\Users\you\AppData\Local\Microsoft\WindowsApps\python3.exe
  where python  -> C:\Users\you\AppData\Local\Microsoft\WindowsApps\python.exe
  python3 -c ''  -> exit 9009
     "Python was not found; run without arguments to install from the Microsoft Store,
      or disable this shortcut from Settings > Apps > Advanced app settings >
      App execution aliases."
  python  -c ''  -> exit 9009, identical
  ```

  Two things to make explicit, because both break the obvious workaround: the exit code is
  **9009**, not a spawn error, so anything checking for `ENOENT` or `EPERM` sees a normal
  failed process; and on this machine **both names** are stubs, so "fall back to `python`"
  resolves to a second alias. Note also that the dispatcher matters — the cmd.exe that runs
  a hook may resolve a different interpreter than the shell you tested in by hand.
- **Cause** — the App Execution Alias is a real file at a real path whose entire purpose is
  to advertise a Store package. Name-based identity is the trap: the bare name resolves, so
  every presence check passes, and only execution reveals there is no interpreter behind it.
  Do not attribute this to the same mechanism as the EPERM case — that one is a packaged
  binary `CreateProcess` refuses; this one starts, prints and exits.
- **Workaround** — resolve functionally, once: take the first of `python3`, `python`,
  `py` whose **absolute** path actually executes `-c ''`, and bake that absolute path into
  whatever you emit. Resolving at setup time rather than per invocation also keeps a hot
  path from paying an interpreter start. If nothing passes, there is no Python — say so and
  disable the work, rather than emitting a command that will fail per invocation forever.
- **Why the WindowsApps filter is the unsafe fix, and why the corpus says both** — skipping
  anything under `*/WindowsApps/*` does catch this stub, and it also rejects a legitimate
  Store Python, which lives in the same directory. This is the exact point where this case
  and `windowsapps-alias-eperm` disagree, and the disagreement is real rather than a
  contradiction: that case is about `CreateProcess` refusing a packaged binary, where the
  path segment is the only discriminator available; this case is about identity, where
  running the candidate is both available and decisive. The case must say which test to use
  when, because the graph now lists the same workaround as a mitigation of one and an unsafe
  fix for the other.

## MODIFY `ontology/concepts/workaround-skip-windowsapps.md`

Append a `## Why it's unsafe` section. V9 requires it on any node named by an
`unsafe_fix` edge, and it reads the concept file, not this document. This is the round's
**only** edit to an existing concept, and it is a carve-out from the plan's "nothing
existing is rewritten" rule — recorded here rather than made quietly. Content: it rejects a
legitimate Microsoft Store install, which lives in the same directory as the dead alias, so
it is correct only when the question is "will `CreateProcess` refuse this?" and wrong when
the question is "is this a working interpreter?".

## New ontology concepts

| File | type | Definition |
|---|---|---|
| `mechanism-wsl-launcher-path-translation.md` | Mechanism | The WSL launcher on PATH is not a POSIX shell; it starts a guest with no C: drive, so a Windows path handed to it cannot resolve. Its callers have reported it exiting 0 on that failure. |
| `mechanism-app-execution-alias-stub.md` | Mechanism | A Microsoft Store App Execution Alias is a real file that resolves by name and, when run, advertises the Store instead of starting the program, so presence checks pass and only execution disagrees. |
| `error-python-not-found.md` | ErrorSignature | The Store alias exits 9009 printing "Python was not found; run without arguments to install from the Microsoft Store" rather than running an interpreter. |
| `workaround-functional-interpreter-probe.md` | Workaround | Accept an interpreter only when it demonstrably does the job - executes a trivial program, or proves it can see the file it is about to run - and keep the absolute path that passed. |
| `workaround-blacklist-bash-by-path.md` | Workaround | Reject bash by known bad path, such as System32 or WindowsApps. Ships with "## Why it's unsafe" (V9). |

Reused: `env-windows`, `shell-cmd`, `runtime-python`, `command-where`,
`workaround-absolute-spawn`, `workaround-skip-windowsapps` (modified above).

## Gate for this phase

```
bun scripts/lint-cases.mjs                                    # expect "108 cases OK"
bun scripts/build-graph.mjs && bun scripts/validate-graph.mjs  # expect exit 0, V9 satisfied
bun scripts/fp.mjs case windowsapps-python3-stub-needs-probe
```
