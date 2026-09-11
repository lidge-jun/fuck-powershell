---
id: workaround-blacklist-bash-by-path
type: Workaround
label: "blacklist bash by path"
---

## Definition

Reject a bash candidate by known bad path, such as System32 or WindowsApps, instead of testing what it does.

## Why it's unsafe

It is a path heuristic wearing the clothes of an identity check. It accepts an equally broken bash found anywhere else, and it hard-codes a list that a portable, scoop or winget install is not on. A candidate that cannot open the file it is about to run should be rejected for that reason, not for where it lives.

