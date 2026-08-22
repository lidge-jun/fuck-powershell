---
id: workaround-continue-eap
type: Workaround
label: "continue eap"
---

## Definition

Temporarily set $ErrorActionPreference='Continue' around native calls on 5.1, then check $LASTEXITCODE.
