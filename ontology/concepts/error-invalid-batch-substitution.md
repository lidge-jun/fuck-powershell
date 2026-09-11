---
id: error-invalid-batch-substitution
type: ErrorSignature
label: "invalid batch substitution"
---

## Definition

cmd.exe rejects a %~ batch-parameter substitution it cannot resolve, reports the usage as invalid and points the reader at CALL /? or FOR /?, then aborts the script with exit 255.

