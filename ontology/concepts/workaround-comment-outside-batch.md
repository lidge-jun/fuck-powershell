---
id: workaround-comment-outside-batch
type: Workaround
label: "comment outside batch"
---

## Definition

Keep prose that names a %~ modifier out of batch files, or break the token so it cannot parse as a substitution. REM and :: both still perform batch parameter substitution, so neither comment form is a safe place to spell one.

