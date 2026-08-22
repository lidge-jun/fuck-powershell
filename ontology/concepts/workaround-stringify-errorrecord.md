---
id: workaround-stringify-errorrecord
type: Workaround
label: "stringify errorrecord"
---

## Definition

Capture native stderr as strings (.ToString() per record or 2>&1 | ForEach-Object ToString) before logging.
