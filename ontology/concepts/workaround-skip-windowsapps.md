---
id: workaround-skip-windowsapps
type: Workaround
label: "skip windowsapps"
---

## Definition

Skip WindowsApps appExecLink aliases during command resolution; prefer real installs.

## Why it's unsafe

It is correct only for the question "will CreateProcess refuse this binary?", where
the WindowsApps path segment is the only discriminator that works. It is wrong for
"is this a working interpreter?", because a legitimate Microsoft Store install lives
in the same directory as the dead alias and gets rejected with it. When the candidate
can simply be run, run it.
