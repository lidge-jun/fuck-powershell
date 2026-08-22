---
id: path-unmatched-quote-swallows
title: "one stray quote in PATH makes every entry after it disappear, for your program only — the same shell still finds them"
category: env-paths
versions: "both"
failure: misleading-error
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/42
  - https://github.com/openai/codex/issues/38421
ontology:
  affects: [env-windows, runtime-node]
  manifests_as: [error-command-not-recognized]
  caused_by: [mechanism-quoted-path-entry]
  mitigated_by: [workaround-split-path-on-semicolon]
---

# one stray quote in PATH makes every entry after it disappear, for your program only — the same shell still finds them

## Symptom

Your program cannot find a tool that is unambiguously installed and on PATH:

```
Error: failed to run git clone ...: program not found
```

From the same shell, in the same session:

```
PS> where.exe git
C:\Users\me\AppData\Local\hermes\git\cmd\git.exe
PS> git --version
git version 2.54.0.windows.1
```

So the tool is there, the shell finds it, and your process says it does not
exist. Every diagnostic you reach for agrees with the shell and against your
program, which is why this burns an afternoon.

## Repro

```powershell
PS> $env:PATH = 'C:\Program Files\PowerShell\7";' + 'C:\tools\git\cmd' + ';C:\Windows\System32'
PS> where.exe git          # found
PS> node -e "console.log(require('child_process').spawnSync('git',['--version']).error?.code)"
ENOENT
```

The stray `"` after `7` is the whole bug. It is trivially easy to produce: a
quoted PATH entry with a typo, an installer that appends without checking, or a
hand-edited environment variable.

## Cause

Windows PATH entries may be QUOTED, because the separator is `;` and a directory
name may legally contain one. So a correct PATH parser has to be quote-aware:
inside quotes, a semicolon is data rather than a separator.

That is exactly what makes an unmatched quote catastrophic. The parser opens a
quoted span at the stray `"` and never finds its closer, so every remaining
semicolon is swallowed as part of one enormous, nonexistent directory name. Rust's
`std::env::split_paths` behaves this way, and it is behaving correctly.

Whether you are affected depends entirely on which splitter you use:

- Quote-aware splitters (`std::env::split_paths`, and anything modelling the
  documented rules) lose every entry after the stray quote.
- Naive `split(';')` — which most scripts and many runtimes use — is unaffected,
  because it never opened a span.
- `where.exe` and PowerShell's own command resolution are unaffected.

So the failure is not "PATH is broken". It is "PATH is broken for the correct
parsers only", which inverts the usual debugging instinct: the tools you trust to
check are the ones that cannot see the problem.

## Workaround

Fix the PATH — but you usually cannot, because it is the user's machine. So make
the failure legible instead:

```rust
let raw = std::env::var_os("PATH").unwrap_or_default();
let quotes = raw.to_string_lossy().matches('"').count();
if quotes % 2 != 0 {
    eprintln!("PATH contains an unmatched quote; entries after it are unreadable");
}
```

An odd number of quote characters in PATH is always a bug in the PATH, and
checking for it costs one line. Reporting THAT instead of "program not found"
turns a multi-hour hunt into a one-line fix for the user.

If you must be tolerant, fall back to naive semicolon splitting when the
quote-aware parse yields an entry containing `;` — that entry is fictional by
construction.

---

`node-path-host-delimiter` is about the SEPARATOR being wrong (`:` versus `;`).
This is one level deeper: the separator is right, the parse is right, and one
character of user data makes the correct parser produce a fictional answer.
