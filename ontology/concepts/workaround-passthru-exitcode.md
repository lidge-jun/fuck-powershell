---
id: workaround-passthru-exitcode
type: Workaround
label: "passthru exitcode"
---

## Definition

Use Start-Process -PassThru -Wait and read .ExitCode; $LASTEXITCODE is not set by Start-Process.
