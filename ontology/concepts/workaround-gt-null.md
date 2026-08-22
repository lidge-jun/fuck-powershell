---
id: workaround-gt-null
type: Workaround
label: "gt null"
---

## Definition

Redirect function body output with > $null to silence pipeline pollution.

## Why it's unsafe

Blanket-redirecting hides legitimate return values and errors too; capture or Out-Null the SPECIFIC side-effect calls instead.
