---
id: workaround-set-content-utf8nobom
type: Workaround
label: "set content utf8nobom"
---

## Definition

Use Set-Content -Encoding utf8NoBOM on pwsh 7 for POSIX-consumable files.

## Why it's unsafe

Tempting fix that trades one failure for a worse one; see citing cases.
