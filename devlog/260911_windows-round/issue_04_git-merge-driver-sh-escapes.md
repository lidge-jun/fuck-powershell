**Category:** args-quoting · **Versions:** both · **Failure:** silent · **Context:** script, agent · **Source:** first-party · **Repro:** verified

## Symptom

You register a custom merge driver so that a structured file merges by rule instead
of by line:

```
git config merge.mine.driver "/path/to/mydriver %O %A %B %P"
```

and `.gitattributes` binds it with `*.md merge=mine`. On Windows the merge comes
back as an ordinary conflict:

```
Auto-merging f.md
CONFLICT (content): Merge conflict in f.md
Automatic merge failed; fix conflicts and then commit the result.
```

Exit 1, conflict markers in the file, nothing that says a driver was involved. The
reasonable reading is that the driver ran and could not resolve it. The driver never
ran at all. Above the CONFLICT line — easy to miss, and gone once a tool captures
only the last lines — is a shell error about a command that does not exist.

## Repro

Full script: `devlog/260911_windows-round/repro-merge-driver.ps1`. Three registrations
of the *same working driver*, same repository, same conflict.

**A — a Windows path with backslashes:**

```
driver : C:\Users\me\AppData\Local\Temp\fp-mergedriver\mydriver %O %A %B %P
git    : C:\Users\...\mydriver .merge_file_DULjNk .merge_file_yAo41X .merge_file_ygd7B7 'f.md':
         line 1: C:UssuperAppDataLocalTempfp-mergedrivermydriver: command not found
git    : CONFLICT (content): Merge conflict in f.md
exit   : 1
f.md   : mine
```

Every backslash is gone from the path in the error message. `C:\Users\me\...` was
consumed as escape sequences.

**B — same driver, forward slashes, still extensionless with a shebang:**

```
driver : C:/Users/me/AppData/Local/Temp/fp-mergedriver/mydriver %O %A %B %P
git    : Python was not found; run without arguments to install from the Microsoft Store, ...
git    : CONFLICT (content): Merge conflict in f.md
exit   : 1
f.md   : mine
```

The path now resolves and the shebang is honoured — straight into the Microsoft
Store `python3` execution alias.

**C — explicit interpreter, forward slashes, both quoted:**

```
driver : "C:/Users/me/.../python3.cmd" "C:/Users/me/.../mydriver" %O %A %B %P
git    : Auto-merging f.md
git    : Merge made by the 'ort' strategy.
exit   : 0
f.md   : MERGED-BY-DRIVER
```

All three failures present identically to a caller that checks the exit code: exit
1, conflict markers, no driver output.

## Cause

Git does not `CreateProcess` the driver command. It runs it through a shell, and on
Windows that is Git's bundled `sh`. So the value of `merge.<name>.driver` is a
**shell command line**, not an argv vector, and it gets shell tokenisation applied
to it: backslash is an escape character, and `C:\Users\me` becomes `C:Usersme`.
The placeholders `%O %A %B %P` are substituted by git before the shell sees them,
which is why they must stay unquoted while everything around them must be quoted.

The second layer is that an extensionless file is only executable through its
shebang, and `#!/usr/bin/env python3` on Windows resolves `python3` through PATH,
where the Store execution alias usually sits first. Git's own `chmod +x` is
meaningless here too: with `core.filemode=false` on NTFS there is no executable bit
to set.

What makes it a landmine rather than a bug is git's fallback. A merge driver that
exits non-zero is *defined* to mean "conflict", so a driver that could not be
launched is indistinguishable from a driver that ran and disagreed. Git reports the
documented outcome for a failure it did not cause.

## Workaround

Name the interpreter, use forward slashes, quote both paths, leave the placeholders bare:

```bash
PY=$(command -v python3 || command -v python)
case "$PY" in *WindowsApps*) echo "Store stub; install real CPython" >&2; exit 1 ;; esac
DRIVER=$(cygpath -m "$PWD/bin/mydriver")     # -m gives C:/... with forward slashes
git config merge.mine.driver "\"$PY\" \"$DRIVER\" %O %A %B %P"
```

Quoting is not optional the moment a path contains a space — `Program Files` or any
user whose name has one — and `cygpath -m` is the piece that avoids the backslash
problem at the source rather than escaping around it.

Verify by asserting on the *result*, never on git's exit code:

```
git merge other
test "$(cat f.md)" = "MERGED-BY-DRIVER"
```

Do not debug this by reading the tail of git's output. The only line that explains
it is printed before `Auto-merging`, and it is the first thing a log tail drops.

---

`dollar-backslash-vars` and `backslash-quote-ends-span` are the same backslash-as-escape
mechanism in other quoting contexts; this is the git-config surface of it, where the
consequence is a wrong merge rather than a failed command. `windowsapps-alias-eperm`
is variant B's root cause — there it surfaces as EPERM at spawn, here as a friendly
sentence on stdout that a merge driver treats as its output.

