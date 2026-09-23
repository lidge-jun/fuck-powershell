---
id: workaround-skip-windowsapps
type: Workaround
label: "skip windowsapps"
---

## Definition

Skip WindowsApps appExecLink aliases during command resolution; prefer real installs.

## Why it's unsafe

This is valid only when the question is whether CreateProcess can run the WindowsApps alias stub. Applying it as a general interpreter probe also rejects legitimate Microsoft Store installs, which can live in the same directory; execute the candidate when it is safe to do so.
